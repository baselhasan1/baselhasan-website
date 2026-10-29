import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { UBAHN_REFS } from "../data/ubahnLines.js";
import UbahnPanel from "./UbahnPanel.jsx";
import MapPlaceLabels from "./MapPlaceLabels.jsx";
import { loadGeoJson } from "../utils/loadGeoJson.js";
import { prefetchBounds, viewportAt } from "../utils/tilePrefetch.js";
import MapTileLayer from "./MapTileLayer.jsx";
import MapTilePrefetch from "./MapTilePrefetch.jsx";
import { SmoothWheelZoom } from "../utils/smoothWheelZoom.js";
import "../utils/leafletPatches.js";
import {
  AttributionControl,
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  Polyline,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";

const MIN_ZOOM = 5;
// Esri serves real imagery to 19 over the cities this map visits, so that is
// the ceiling. It upsamples beyond, which would only look soft.
const MAX_ZOOM = 19;

// Chapters always frame at their original scale even though the map can now
// be zoomed much deeper by hand.
const FRAME_ZOOM_CAP = 11;

// Leaflet is allowed to pull back this far while flying between countries,
// so the journey arc has room to show.
const FLIGHT_MIN_ZOOM = 3;

// Camera flight lengths, in seconds. Long enough to read as a journey, short
// enough that switching chapters never feels like waiting.
const COUNTRY_FLIGHT_S = 1.3;
const CITY_FLIGHT_S = 0.8;
// Grace period after a flight before the safety timer lands it regardless.
const LANDING_GRACE_MS = 250;
// How far into a flight the sharp imagery resumes loading. Late enough that
// the camera is near its final level, early enough that the (prefetched)
// destination tiles are painted by the time it lands.
const SHARP_RESUME_AT = 0.75;

// Tiles requested beyond the viewport edge (so a pan lands on imagery) and
// retained beyond that before being pruned.
const TILE_EDGE_BUFFER = 1;
const TILE_KEEP_BUFFER = 3;
// How often tiles are (re)requested while the camera is moving, in ms.
const TILE_UPDATE_INTERVAL = 120;
// Two layers sit under the sharp one, and between them nothing is ever bare.
//
// The floor is pinned low, so its handful of tiles are fetched once and then
// always available however far the camera jumps. It is very blurry at close
// range, so it is only a last resort.
//
// Above it, the tracking underlay fetches four levels below the camera. That
// is a constant, mild blur at any zoom rather than one that worsens the
// further in you go, and it covers the ordinary case: a level or two of zoom,
// where the floor used to be what you saw.
const UNDERLAY_FLOOR_NATIVE_ZOOM = 7;
const UNDERLAY_ZOOM_OFFSET = 4;
const UNDERLAY_FLIGHT_ZOOM_OFFSET = 1;
const FLOOR_FLIGHT_ZOOM_OFFSET = 3;

// Esri World Imagery: 0.3 m over Western European metros, no key required.
// Note the {z}/{y}/{x} ordering — Esri puts row before column.
//
// The same tiles (same ETags) are served from two hostnames. Esri answers
// over HTTP/1.1, where a browser opens only six connections per host, so
// alternating between the two doubles how many tiles load at once. Leaflet
// picks the host from the tile's position, so each tile always comes from
// the same one and the cache still hits.
const SATELLITE_TILE_URL =
  "https://{s}.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_SUBDOMAINS = ["server", "services"];
const SATELLITE_ATTRIBUTION =
  'Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics';
// Esri also publishes a place-name layer, but it is raster: it re-renders at
// every zoom level, so names fade out and back and change size as you zoom.
// The map draws its own instead — see MapPlaceLabels.
const FALLBACK_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const FALLBACK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; CARTO';

const BerlinUbahnLayer = lazy(() => import("./BerlinUbahnLayer.jsx"));

// Borders sit on top of imagery, so they're a white hairline rather than a fill.
const COUNTRY_STYLE = () => ({
  color: "#ffffff",
  weight: 1.6,
  opacity: 0.95,
  dashArray: "6 6",
  fill: false,
});

const CITY_OUTLINE_STYLE = () => ({
  color: "#ffffff",
  weight: 1.8,
  opacity: 0.9,
  dashArray: "5 6",
  fill: false,
});

const WILDAU_NAME = "Technical University of Applied Sciences Wildau";

const GERMANY_PLACE_ANCHORS = {
  wildau: {
    coordinates: [52.3194, 13.6325],
    bounds: [
      [52.28, 13.58],
      [52.35, 13.69],
    ],
    exploreBounds: [
      [52.25, 13.54],
      [52.38, 13.73],
    ],
  },
  berlin: {
    coordinates: [52.52, 13.405],
    bounds: [
      [52.32, 13.15],
      [52.67, 13.65],
    ],
    exploreBounds: [
      [52.2, 13.0],
      [52.77, 13.78],
    ],
  },
  frankfurt: {
    coordinates: [50.1109, 8.6821],
    bounds: [
      [49.98, 8.45],
      [50.22, 8.92],
    ],
    exploreBounds: [
      [49.9, 8.25],
      [50.3, 9.1],
    ],
  },
};

function getCurrentAnchor(selectedPoint, selectedGermanyPlace, locations) {
  if (selectedPoint === "germany") {
    return GERMANY_PLACE_ANCHORS[selectedGermanyPlace] || locations.germany;
  }
  return locations[selectedPoint];
}

function sameCoords(a, b) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

function getVisibleCities(selectedPoint, selectedGermanyPlace, locations) {
  const cities = locations[selectedPoint]?.cities || [];

  if (selectedPoint === "germany" && selectedGermanyPlace !== "wildau") {
    return cities.filter((city) => city.name !== WILDAU_NAME);
  }

  return cities;
}

function getVisiblePois(selectedPoint, selectedGermanyPlace, locations) {
  if (selectedPoint !== "germany") {
    return locations[selectedPoint]?.pois || [];
  }

  const pois = locations.germany?.pois || {};
  return pois[selectedGermanyPlace] || pois.overview || [];
}

/* ------------------------------------------------------------------ */
/* Category icons                                                      */
/* ------------------------------------------------------------------ */

function getCategoryColor(category) {
  if (category === "restaurant") return "#b45309";
  if (category === "education") return "#2563eb";
  if (category === "fun") return "#16a34a";
  return "#111827";
}

function getCategoryLabel(category) {
  if (category === "restaurant") return "Restaurants";
  if (category === "education") return "Educational institutions";
  if (category === "fun") return "Fun";
  return "";
}

function getCategorySvgMarkup(category, color = "#111827", size = 18) {
  const attrs = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

  if (category === "restaurant") {
    return `<svg ${attrs}><path d="M4 3v7" /><path d="M7 3v7" /><path d="M4 7h3" /><path d="M6 10v11" /><path d="M14 3v8" /><path d="M14 11c2.2 0 4-1.8 4-4V3" /><path d="M14 11v10" /></svg>`;
  }

  if (category === "education") {
    return `<svg ${attrs}><path d="M2 6.5C2 5.7 2.7 5 3.5 5H10c1.2 0 2 .8 2 2v12c0-1.2-.8-2-2-2H3.5C2.7 17 2 17.7 2 18.5V6.5Z" /><path d="M22 6.5C22 5.7 21.3 5 20.5 5H14c-1.2 0-2 .8-2 2v12c0-1.2.8-2 2-2h6.5c.8 0 1.5.7 1.5 1.5V6.5Z" /></svg>`;
  }

  return `<svg ${attrs}><circle cx="12" cy="12" r="9" /><path d="M8.5 9.5h.01" /><path d="M15.5 9.5h.01" /><path d="M8.5 14.5c1 1.5 2.2 2 3.5 2s2.5-.5 3.5-2" /></svg>`;
}

function CategoryIcon({ category, size = 16, color }) {
  const stroke = color || getCategoryColor(category);

  return (
    <span
      style={{ display: "inline-flex" }}
      dangerouslySetInnerHTML={{
        __html: getCategorySvgMarkup(category, stroke, size),
      }}
    />
  );
}

function createPoiIcon(category) {
  const color = getCategoryColor(category);

  return divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
    tooltipAnchor: [0, -18],
    html: `
      <div
        class="bh-poi"
        style="
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background: rgba(255,255,255,0.98);
          border: 2px solid ${color};
          box-shadow: 0 8px 18px rgba(0,0,0,0.14);
          display: flex;
          align-items: center;
          justify-content: center;
        "
      >
        ${getCategorySvgMarkup(category, color, 18)}
      </div>
    `,
  });
}

function createHeroIcon() {
  return divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
    tooltipAnchor: [0, -14],
    html: `<div class="bh-pin-wrap"><span class="bh-pin-halo"></span><span class="bh-pin"></span></div>`,
  });
}

function createDotIcon(isClickable) {
  return divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
    tooltipAnchor: [0, -10],
    html: `<div class="bh-dot ${isClickable ? "bh-dot--clickable" : ""}"></div>`,
  });
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

const CARD_FONT =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function PoiHoverCard({ poi }) {
  const categoryColor = getCategoryColor(poi.category);

  return (
    <div
      style={{
        minWidth: "220px",
        maxWidth: "260px",
        fontFamily: CARD_FONT,
        color: "#111827",
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "999px",
            border: `1.5px solid ${categoryColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <CategoryIcon category={poi.category} size={15} color={categoryColor} />
        </div>

        <div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>{poi.name}</div>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: categoryColor,
              fontWeight: 700,
            }}
          >
            {getCategoryLabel(poi.category)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PoiPopupCard({ poi }) {
  const categoryColor = getCategoryColor(poi.category);

  return (
    <div
      style={{
        minWidth: "240px",
        fontFamily: CARD_FONT,
        color: "#111827",
        lineHeight: 1.6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "999px",
            border: `1.5px solid ${categoryColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <CategoryIcon category={poi.category} size={16} color={categoryColor} />
        </div>

        <div>
          <div style={{ fontSize: "16px", fontWeight: 700 }}>{poi.name}</div>
          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: categoryColor,
              fontWeight: 700,
            }}
          >
            {getCategoryLabel(poi.category)}
          </div>
        </div>
      </div>

      {poi.description && (
        <div
          style={{
            fontSize: "14px",
            color: "#44403c",
            marginBottom: poi.url ? "12px" : 0,
          }}
        >
          {poi.description}
        </div>
      )}

      {poi.url && (
        <a
          href={poi.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
            fontWeight: 700,
            color: "#111827",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          Visit website <span>↗</span>
        </a>
      )}
    </div>
  );
}

function CityPopupCard({ city }) {
  return (
    <div
      style={{
        minWidth: "220px",
        fontFamily: CARD_FONT,
        color: "#111827",
        lineHeight: 1.6,
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 700,
          marginBottom: city.url ? "10px" : 0,
        }}
      >
        {city.name}
      </div>

      {city.url && (
        <a
          href={city.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
            fontWeight: 700,
            color: "#111827",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          Visit website <span>↗</span>
        </a>
      )}
    </div>
  );
}

function MapLegend({ colors }) {
  const items = ["restaurant", "education", "fun"];

  return (
    <div
      className="bh-glass bh-glass--panel"
      style={{
        position: "absolute",
        right: "24px",
        // Sits above the zoom controls in the bottom-right stack.
        bottom: "140px",
        zIndex: 1200,
        borderRadius: "18px",
        padding: "14px 14px 12px",
        minWidth: "220px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: colors.muted,
          marginBottom: "10px",
        }}
      >
        Legend
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((category) => {
          const color = getCategoryColor(category);

          return (
            <div
              key={category}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                color: "#111827",
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "999px",
                  border: `1.5px solid ${color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#ffffff",
                  flexShrink: 0,
                }}
              >
                <CategoryIcon category={category} size={14} color={color} />
              </div>
              <span>{getCategoryLabel(category)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

/**
 * Flies the camera to whichever chapter is selected instead of cutting to it.
 * Country hops briefly drop the min zoom and the pan cage so Leaflet can pull
 * back far enough to show the whole journey arc on the way over.
 */
/**
 * Where to put the camera to frame `bounds`, always on a whole zoom level.
 * The map rests on half levels after a wheel zoom (zoomSnap 0.5), but the
 * chapter frames were composed on whole ones and stay that way.
 */
function frameBounds(map, bounds) {
  const { center, zoom } = map._getBoundsCenterZoom(bounds, {
    padding: [56, 56],
    maxZoom: FRAME_ZOOM_CAP,
  });
  return { center, zoom: Math.floor(zoom) };
}

function ChangeMapView({
  selectedPoint,
  selectedGermanyPlace,
  locations,
  onFlightChange,
}) {
  const map = useMap();
  const isFirstRender = useRef(true);
  const previousPoint = useRef(selectedPoint);
  const previousKey = useRef(`${selectedPoint}-${selectedGermanyPlace}`);
  const pendingFinish = useRef(null);
  const finishTimer = useRef(null);
  const resumeTimer = useRef(null);

  useEffect(() => {
    const target = getCurrentAnchor(
      selectedPoint,
      selectedGermanyPlace,
      locations
    );
    if (!target) return;

    const nextKey = `${selectedPoint}-${selectedGermanyPlace}`;

    if (isFirstRender.current) {
      map.setMaxBounds(target.exploreBounds);
      const frame = frameBounds(map, target.bounds);
      map.setView(frame.center, frame.zoom, { animate: false });
      isFirstRender.current = false;
      previousKey.current = nextKey;
      previousPoint.current = selectedPoint;
      return;
    }

    if (previousKey.current === nextKey) return;

    const isCountryHop = previousPoint.current !== selectedPoint;
    previousKey.current = nextKey;
    previousPoint.current = selectedPoint;

    // Cancel any flight still in progress so the two don't fight. Landing the
    // old one would cage the map to the chapter we are leaving.
    if (pendingFinish.current) pendingFinish.current(false);
    map.stop();

    // Open the cage for the duration of the flight.
    map.setMaxBounds(null);
    if (isCountryHop) map.setMinZoom(FLIGHT_MIN_ZOOM);
    onFlightChange(isCountryHop);

    const durationS = isCountryHop ? COUNTRY_FLIGHT_S : CITY_FLIGHT_S;
    const durationMs = durationS * 1000;
    const startedAt = Date.now();

    const land = (applyCage = true) => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
      finishTimer.current = null;
      clearTimeout(resumeTimer.current);
      if (map._container) map.fire("bhflightend");
      if (!pendingFinish.current) return;
      pendingFinish.current = null;
      map.off("moveend", onMoveEnd);
      // React can unmount the map before the timer runs; touching a removed
      // map throws deep inside Leaflet's pan machinery.
      if (!applyCage || !map._container) return;
      map.setMinZoom(MIN_ZOOM);
      map.setMaxBounds(target.exploreBounds);
      onFlightChange(false);
    };

    // `flyTo` tears down whatever animation was running before it starts, and
    // that teardown fires a `moveend` of its own. Landing on that one puts the
    // cage back while the camera is still climbing, and `setMaxBounds` pans the
    // map, which kills the flight where it stands. So ignore anything arriving
    // before the flight could plausibly have finished.
    function onMoveEnd() {
      if (Date.now() - startedAt < durationMs * 0.9) return;
      land();
    }

    pendingFinish.current = land;

    // Tile layers lighten their load for the flight (see flightMode in
    // tileLayer.js) and pick back up as the camera nears the destination.
    map.fire("bhflightstart");
    resumeTimer.current = setTimeout(
      () => map.fire("bhflightend"),
      durationMs * SHARP_RESUME_AT
    );

    const frame = frameBounds(map, target.bounds);
    map.flyTo(frame.center, frame.zoom, {
      duration: durationS,
      easeLinearity: 0.24,
    });
    map.on("moveend", onMoveEnd);
    finishTimer.current = setTimeout(land, durationMs + LANDING_GRACE_MS);

    // Warm the tiles the flight will need while it is in the air, so neither
    // the apex nor the landing paints ground colour. Must come after
    // flyTo: its synchronous movestart clears the prefetch queue, and
    // the queue is FIFO, so the apex (reached first) is queued first.
    const destinationBounds = latLngBounds(target.bounds);
    if (isCountryHop) {
      const arc = map.getBounds().extend(destinationBounds).pad(0.25);
      prefetchBounds(map, arc, FLIGHT_MIN_ZOOM);
      prefetchBounds(map, arc, FLIGHT_MIN_ZOOM + 1);
    }
    const destinationZoom = frame.zoom;
    const destinationCenter = frame.center;
    prefetchBounds(
      map,
      viewportAt(map, destinationCenter, destinationZoom),
      destinationZoom
    );
    if (destinationZoom - 1 >= MIN_ZOOM) {
      prefetchBounds(
        map,
        viewportAt(map, destinationCenter, destinationZoom - 1),
        destinationZoom - 1
      );
    }
  }, [selectedPoint, selectedGermanyPlace, locations, map, onFlightChange]);

  useEffect(
    () => () => {
      // Drop the listener and the timer, but leave the map alone: it is on its
      // way out and its panes may already be gone.
      if (pendingFinish.current) pendingFinish.current(false);
    },
    [map]
  );

  return null;
}

/**
 * Warms the browser cache with the tiles one and two zoom levels out from the
 * current view, so zooming out has something to paint immediately instead of
 * leaving blank squares while the network catches up.
 *
 * The URLs have to match what Leaflet itself would request byte for byte,
 * otherwise the cache never hits — hence the subdomain and @2x handling.
 */
function ZoomPresentationGuard() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    // A smooth wheel zoom re-places labels every frame instead of scaling
    // them, so they stay sharp and can stay visible.
    const start = (event) => {
      if (!event.smooth) container.classList.add("bh-map-zooming");
    };
    const end = () => container.classList.remove("bh-map-zooming");
    map.on("zoomstart", start);
    // A zoom that is interrupted never reaches `zoomend`, and the class would
    // latch on and leave the map's own labels hidden for good. `moveend`
    // always arrives, and never before `zoomend` does.
    map.on("zoomend moveend", end);
    return () => {
      end();
      map.off("zoomstart", start);
      map.off("zoomend moveend", end);
    };
  }, [map]);

  return null;
}

function SmoothWheelZoomHandler() {
  const map = useMap();

  useEffect(() => {
    map.addHandler("smoothWheelZoom", SmoothWheelZoom);
    map.smoothWheelZoom.enable();
    return () => {
      map.smoothWheelZoom.disable();
      delete map.smoothWheelZoom;
    };
  }, [map]);

  return null;
}

function ZoomTracker({ onZoomChange }) {
  const map = useMap();

  useEffect(() => {
    const update = () => onZoomChange(map.getZoom());

    update();
    map.on("zoomend", update);

    return () => {
      map.off("zoomend", update);
    };
  }, [map, onZoomChange]);

  return null;
}

function MapZoomControls({ currentZoom }) {
  const map = useMap();

  const buttonStyle = (isDisabled) => ({
    width: "40px",
    height: "40px",
    color: isDisabled ? "#c7c3bd" : "#111827",
    borderRadius: "14px",
    fontSize: "22px",
    lineHeight: 1,
    cursor: isDisabled ? "default" : "pointer",
    transition: "color 0.16s ease, transform 0.16s ease",
  });

  return (
    <div
      style={{
        position: "absolute",
        right: "24px",
        // Clears the attribution strip pinned to the bottom-right corner.
        bottom: "44px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <button
        onClick={() => map.zoomIn()}
        disabled={currentZoom >= MAX_ZOOM}
        className="bh-glass bh-glass--btn"
        style={buttonStyle(currentZoom >= MAX_ZOOM)}
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        className="bh-glass bh-glass--btn"
        onClick={() => map.zoomOut()}
        disabled={currentZoom <= MIN_ZOOM}
        style={buttonStyle(currentZoom <= MIN_ZOOM)}
        aria-label="Zoom out"
      >
        −
      </button>
    </div>
  );
}

function buildArcPoints(from, to, segments = 72, curvature = 0.16) {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const deltaLat = lat2 - lat1;
  const deltaLng = lng2 - lng1;

  const controlLat = (lat1 + lat2) / 2 - deltaLng * curvature;
  const controlLng = (lng1 + lng2) / 2 + deltaLat * curvature;

  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const inverse = 1 - t;

    points.push([
      inverse * inverse * lat1 + 2 * inverse * t * controlLat + t * t * lat2,
      inverse * inverse * lng1 + 2 * inverse * t * controlLng + t * t * lng2,
    ]);
  }

  return points;
}

/* ------------------------------------------------------------------ */
/* Wildau campus panel                                                 */
/* ------------------------------------------------------------------ */

function ResizableWildauPanel({ colors, onClose, onMouseEnter, onMouseLeave }) {
  const MIN_WIDTH = 300;
  const MIN_HEIGHT = 220;
  const MAX_WIDTH = 900;
  const MAX_HEIGHT = 700;
  const MARGIN = 16;

  const panelRef = useRef(null);
  const dragRef = useRef(null);

  const [panel, setPanel] = useState(() => ({
    // Starts below the floating header so it doesn't sit under the nav.
    top: 96,
    left: Math.max(MARGIN, window.innerWidth - 24 - 420),
    width: 420,
    height: 280,
  }));

  useEffect(() => {
    const handleMove = (event) => {
      if (!dragRef.current) return;

      const {
        direction,
        startX,
        startY,
        startTop,
        startLeft,
        startWidth,
        startHeight,
        parentWidth,
        parentHeight,
      } = dragRef.current;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      let nextTop = startTop;
      let nextLeft = startLeft;
      let nextWidth = startWidth;
      let nextHeight = startHeight;

      if (direction.includes("right")) nextWidth = startWidth + dx;
      if (direction.includes("left")) {
        nextWidth = startWidth - dx;
        nextLeft = startLeft + dx;
      }
      if (direction.includes("bottom")) nextHeight = startHeight + dy;
      if (direction.includes("top")) {
        nextHeight = startHeight - dy;
        nextTop = startTop + dy;
      }

      nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, nextWidth));
      nextHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, nextHeight));

      if (direction.includes("left")) {
        const maxLeft = startLeft + startWidth - MIN_WIDTH;
        nextLeft = Math.min(nextLeft, maxLeft);
        nextLeft = Math.max(MARGIN, nextLeft);
        nextWidth = startWidth - (nextLeft - startLeft);
        nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, nextWidth));
      }

      if (direction.includes("top")) {
        const maxTop = startTop + startHeight - MIN_HEIGHT;
        nextTop = Math.min(nextTop, maxTop);
        nextTop = Math.max(MARGIN, nextTop);
        nextHeight = startHeight - (nextTop - startTop);
        nextHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, nextHeight));
      }

      const maxWidthFromLeft = parentWidth - nextLeft - MARGIN;
      const maxHeightFromTop = parentHeight - nextTop - MARGIN;

      nextWidth = Math.min(nextWidth, maxWidthFromLeft);
      nextHeight = Math.min(nextHeight, maxHeightFromTop);

      setPanel((prev) => ({
        ...prev,
        top: nextTop,
        left: nextLeft,
        width: nextWidth,
        height: nextHeight,
      }));
    };

    const handleUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const startResize = (direction) => (event) => {
    event.preventDefault();
    event.stopPropagation();

    const parent = panelRef.current?.offsetParent;
    if (!parent) return;

    dragRef.current = {
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startTop: panel.top,
      startLeft: panel.left,
      startWidth: panel.width,
      startHeight: panel.height,
      parentWidth: parent.clientWidth,
      parentHeight: parent.clientHeight,
    };

    document.body.style.userSelect = "none";

    if (direction === "top-left" || direction === "bottom-right") {
      document.body.style.cursor = "nwse-resize";
    } else if (direction === "top-right" || direction === "bottom-left") {
      document.body.style.cursor = "nesw-resize";
    } else if (direction === "left" || direction === "right") {
      document.body.style.cursor = "ew-resize";
    } else {
      document.body.style.cursor = "ns-resize";
    }
  };

  const handleStyles = {
    background: "transparent",
    position: "absolute",
    zIndex: 10,
  };

  const edges = [
    ["top", { top: 0, left: 12, right: 12, height: 10, cursor: "ns-resize" }],
    ["bottom", { bottom: 0, left: 12, right: 12, height: 10, cursor: "ns-resize" }],
    ["left", { left: 0, top: 12, bottom: 12, width: 10, cursor: "ew-resize" }],
    ["right", { right: 0, top: 12, bottom: 12, width: 10, cursor: "ew-resize" }],
    ["top-left", { top: 0, left: 0, width: 16, height: 16, cursor: "nwse-resize" }],
    ["top-right", { top: 0, right: 0, width: 16, height: 16, cursor: "nesw-resize" }],
    [
      "bottom-left",
      { bottom: 0, left: 0, width: 16, height: 16, cursor: "nesw-resize" },
    ],
    [
      "bottom-right",
      { bottom: 0, right: 0, width: 16, height: 16, cursor: "nwse-resize" },
    ],
  ];

  return (
    <div
      ref={panelRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "absolute",
        top: `${panel.top}px`,
        left: `${panel.left}px`,
        width: `${panel.width}px`,
        height: `${panel.height}px`,
        zIndex: 1200,
        borderRadius: "20px",
        // Stays opaque: it frames an iframe, which glass can't blur through.
        background: "#ffffff",
        border: `1px solid ${colors.subtleBorder}`,
        boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          borderBottom: `1px solid ${colors.subtleBorder}`,
          background: "#fafaf9",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700 }}>{WILDAU_NAME}</div>
          <div style={{ fontSize: "12px", color: colors.muted }}>
            Resize from any side or corner
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: colors.buttonBg,
            border: `1px solid ${colors.subtleBorder}`,
            color: colors.text,
            borderRadius: "10px",
            width: "30px",
            height: "30px",
            cursor: "pointer",
            flexShrink: 0,
          }}
          aria-label="Close Wildau map"
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <iframe
          src="https://maps.th-wildau.de/"
          title="Technical University of Applied Sciences Wildau map"
          style={{ width: "100%", height: "100%", border: "none" }}
          loading="lazy"
        />
      </div>

      {edges.map(([direction, style]) => (
        <div
          key={direction}
          onMouseDown={startResize(direction)}
          style={{ ...handleStyles, ...style }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Journey view                                                        */
/* ------------------------------------------------------------------ */

function JourneyView({
  selectedPoint,
  selectedGermanyPlace,
  locations,
  handleSelectCountry,
  colors,
  focusCountries,
  mapDataError,
  isActive,
}) {
  const [currentZoom, setCurrentZoom] = useState(MIN_ZOOM);
  const [showWildauMap, setShowWildauMap] = useState(false);
  const [wildauMapPinned, setWildauMapPinned] = useState(false);
  const [berlinOutline, setBerlinOutline] = useState(null);
  const [frankfurtOutline, setFrankfurtOutline] = useState(null);
  const [flightHop, setFlightHop] = useState(false);
  const [visibleLines, setVisibleLines] = useState(
    () => new Set(UBAHN_REFS)
  );
  const [ubahnStats, setUbahnStats] = useState({
    status: "loading",
    trains: 0,
    updatedAt: null,
  });
  const [tileProvider, setTileProvider] = useState("satellite");
  const [tileStatus, setTileStatus] = useState("loading");
  const tileFailures = useRef(0);

  const activeLocation = locations[selectedPoint];

  const visibleCities = useMemo(
    () => getVisibleCities(selectedPoint, selectedGermanyPlace, locations),
    [selectedPoint, selectedGermanyPlace, locations]
  );
  const visiblePois = useMemo(
    () => getVisiblePois(selectedPoint, selectedGermanyPlace, locations),
    [selectedPoint, selectedGermanyPlace, locations]
  );

  const anchor = getCurrentAnchor(selectedPoint, selectedGermanyPlace, locations);
  const anchorCoords = anchor?.coordinates;
  const isChapterAnchor = sameCoords(anchorCoords, activeLocation?.coordinates);

  const onWildauTab =
    selectedPoint === "germany" && selectedGermanyPlace === "wildau";

  // Navigating away from the Wildau tab puts the campus panel away.
  const [wasOnWildauTab, setWasOnWildauTab] = useState(onWildauTab);
  if (wasOnWildauTab !== onWildauTab) {
    setWasOnWildauTab(onWildauTab);
    if (!onWildauTab) {
      setShowWildauMap(false);
      setWildauMapPinned(false);
    }
  }

  const handleZoomChange = useCallback((zoom) => setCurrentZoom(zoom), []);
  const handleTileLoad = useCallback(() => {
    tileFailures.current = 0;
    setTileStatus("ready");
  }, []);
  const handleTileError = useCallback(() => {
    tileFailures.current += 1;
    if (tileFailures.current >= 4) {
      setTileProvider("fallback");
      setTileStatus("fallback");
    }
  }, []);
  const retrySatellite = useCallback(() => {
    tileFailures.current = 0;
    setTileStatus("loading");
    setTileProvider("satellite");
  }, []);

  // Stable identities: the tile layers re-bind handlers when these change.
  const imageryEvents = useMemo(
    () => ({ load: handleTileLoad, tileerror: handleTileError }),
    [handleTileLoad, handleTileError]
  );
  const tileSources = useMemo(
    () =>
      tileProvider === "satellite"
        ? [{ url: SATELLITE_TILE_URL, subdomains: SATELLITE_SUBDOMAINS, maxZoom: MAX_ZOOM }]
        : [{ url: FALLBACK_TILE_URL, subdomains: "abcd", maxZoom: MAX_ZOOM }],
    [tileProvider]
  );
  const tileSubdomains = tileProvider === "satellite" ? SATELLITE_SUBDOMAINS : "abcd";

  const shouldNeedBerlinOutline =
    selectedPoint === "germany" &&
    (selectedGermanyPlace === "berlin" ||
      selectedGermanyPlace === "wildau" ||
      (selectedGermanyPlace === "overview" && currentZoom >= 7));

  const shouldNeedFrankfurtOutline =
    selectedPoint === "germany" &&
    (selectedGermanyPlace === "frankfurt" ||
      (selectedGermanyPlace === "overview" && currentZoom >= 6));

  // Berlin belongs to the live U-Bahn layer, so its POIs stay off the map.
  // The data is still in journeyData.js if it should ever come back.
  const onBerlinTab =
    selectedPoint === "germany" && selectedGermanyPlace === "berlin";

  const showPois =
    onBerlinTab
      ? false
      : selectedPoint === "bahrain"
        ? currentZoom >= 8
        : selectedGermanyPlace === "frankfurt" ||
            selectedGermanyPlace === "wildau"
          ? true
          : currentZoom >= 11;

  useEffect(() => {
    if (!shouldNeedBerlinOutline || berlinOutline) return;

    loadGeoJson("geo/berlin-outline.geojson")
      .then(setBerlinOutline)
      .catch((error) =>
        console.error("Error loading berlin-outline.geojson:", error)
      );
  }, [shouldNeedBerlinOutline, berlinOutline]);

  useEffect(() => {
    if (!shouldNeedFrankfurtOutline || frankfurtOutline) return;

    loadGeoJson("geo/frankfurt-outline.geojson")
      .then(setFrankfurtOutline)
      .catch((error) =>
        console.error("Error loading frankfurt-outline.geojson:", error)
      );
  }, [shouldNeedFrankfurtOutline, frankfurtOutline]);

  const activeCountryFeature = useMemo(() => {
    if (!focusCountries?.features) return null;
    const iso = selectedPoint === "germany" ? "DEU" : "BHR";
    return focusCountries.features.find(
      (feature) => feature.properties?.iso === iso
    );
  }, [focusCountries, selectedPoint]);

  const arcPoints = useMemo(
    () =>
      buildArcPoints(
        locations.bahrain.coordinates,
        locations.germany.coordinates
      ),
    [locations]
  );

  const heroIcon = useMemo(() => createHeroIcon(), []);
  const clickableDotIcon = useMemo(() => createDotIcon(true), []);
  const plainDotIcon = useMemo(() => createDotIcon(false), []);
  const poiIcons = useMemo(
    () => ({
      restaurant: createPoiIcon("restaurant"),
      education: createPoiIcon("education"),
      fun: createPoiIcon("fun"),
    }),
    []
  );

  const handleFlightChange = useCallback((isHop) => setFlightHop(isHop), []);

  // Stable identity: the U-Bahn layer rebuilds itself if this changes.
  const handleUbahnStats = useCallback((stats) => setUbahnStats(stats), []);

  const handleToggleLine = useCallback((ref) => {
    setVisibleLines((previous) => {
      const next = new Set(previous);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }, []);

  const handleSetAllLines = useCallback((on) => {
    setVisibleLines(on ? new Set(UBAHN_REFS) : new Set());
  }, []);

  const handleWildauHoverStart = () => {
    if (onWildauTab) setShowWildauMap(true);
  };

  const handleWildauHoverEnd = () => {
    if (!wildauMapPinned) setShowWildauMap(false);
  };

  const handleWildauClick = () => {
    if (!onWildauTab) return;

    if (wildauMapPinned) {
      setWildauMapPinned(false);
      setShowWildauMap(false);
    } else {
      setWildauMapPinned(true);
      setShowWildauMap(true);
    }
  };

  // Berlin and Frankfurt drill into their own sub-tab; everything else is
  // just a landmark.
  const getCityTab = (cityName) => {
    if (selectedPoint !== "germany") return null;
    if (cityName === "Berlin") return "berlin";
    if (cityName === "Frankfurt") return "frankfurt";
    return null;
  };

  return (
    <div
      className="bh-map"
      role="region"
      aria-label="Interactive map of Basel Hasan's journey from Bahrain to Germany"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
        <MapContainer
          // Replaced by SmoothWheelZoom below.
          scrollWheelZoom={false}
          dragging={true}
          doubleClickZoom={true}
          touchZoom={true}
          boxZoom={true}
          keyboard={true}
          // Animated zoom keeps the previous tiles on screen, scaled, while
          // the next level fades in over them; a hard cut is what made the
          // map load in squares.
          zoomAnimation={true}
          markerZoomAnimation={true}
          fadeAnimation={true}
          // Leaflet stops animating past this many levels in one go and hard
          // resets the view instead, which tears down every tile grid at once
          // and leaves bare ground for as long as the reload takes. Raising it
          // past anything a wheel flick can produce keeps the tiles on screen
          // to scale through the jump.
          zoomAnimationThreshold={12}
          zoomControl={false}
          attributionControl={false}
          maxZoom={MAX_ZOOM}
          minZoom={MIN_ZOOM}
          maxBoundsViscosity={0.6}
          // The wheel rests on half levels (see smoothWheelZoom.js). Without
          // this, the next pan back inside the max bounds would round the
          // zoom to a whole level and animate there on its own.
          zoomSnap={0.5}
          style={{ height: "100%", width: "100%" }}
        >
          <ChangeMapView
            selectedPoint={selectedPoint}
            selectedGermanyPlace={selectedGermanyPlace}
            locations={locations}
            onFlightChange={handleFlightChange}
          />
          <ZoomTracker onZoomChange={handleZoomChange} />
          <ZoomPresentationGuard />
          <SmoothWheelZoomHandler />
          <MapTilePrefetch sources={tileSources} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} />
          <MapZoomControls currentZoom={currentZoom} />
          <AttributionControl position="bottomright" prefix={false} />

          {/* Floor: a handful of tiles fetched once, so however far the camera
              jumps there is always something painted rather than bare ground. */}
          <MapTileLayer
            url={tileProvider === "satellite" ? SATELLITE_TILE_URL : FALLBACK_TILE_URL}
            subdomains={tileSubdomains}
            maxZoom={MAX_ZOOM}
            maxNativeZoom={UNDERLAY_FLOOR_NATIVE_ZOOM}
            // Below its pinned level the floor fetches at the camera's level,
            // a full screen per level a flight passes through. While flying it
            // tracks three levels below instead: a few tiles per level, enough
            // that the ground is never bare under the underlay.
            flightMode={FLOOR_FLIGHT_ZOOM_OFFSET}
            keepBuffer={3}
            edgeBufferTiles={2}
            updateWhenIdle={false}
            updateInterval={TILE_UPDATE_INTERVAL}
            zIndex={0}
          />

          {/* Tracking underlay: four levels below the camera, so the usual
              fallback is mildly soft instead of the floor's heavy blur. */}
          <MapTileLayer
            url={tileProvider === "satellite" ? SATELLITE_TILE_URL : FALLBACK_TILE_URL}
            subdomains={tileSubdomains}
            maxZoom={MAX_ZOOM}
            nativeZoomOffset={UNDERLAY_ZOOM_OFFSET}
            // Mid-flight it stands in for the held sharp layer, so it
            // sharpens to one level below the camera: a quarter of the
            // sharp layer's tiles, and soft only by a factor of two.
            flightMode={UNDERLAY_FLIGHT_ZOOM_OFFSET}
            keepBuffer={3}
            edgeBufferTiles={2}
            updateWhenIdle={false}
            updateInterval={TILE_UPDATE_INTERVAL}
            zIndex={1}
          />

          {tileProvider === "satellite" ? (
            <MapTileLayer
              url={SATELLITE_TILE_URL}
              subdomains={SATELLITE_SUBDOMAINS}
              attribution={SATELLITE_ATTRIBUTION}
              maxZoom={MAX_ZOOM}
              keepBuffer={TILE_KEEP_BUFFER}
              edgeBufferTiles={TILE_EDGE_BUFFER}
              updateWhenIdle={false}
              updateInterval={TILE_UPDATE_INTERVAL}
              flightMode="hold"
              zIndex={2}
              eventHandlers={imageryEvents}
            />
          ) : (
            <MapTileLayer
              url={FALLBACK_TILE_URL}
              attribution={FALLBACK_ATTRIBUTION}
              subdomains="abcd"
              maxZoom={MAX_ZOOM}
              keepBuffer={TILE_KEEP_BUFFER}
              edgeBufferTiles={TILE_EDGE_BUFFER}
              updateWhenIdle={false}
              updateInterval={TILE_UPDATE_INTERVAL}
              flightMode="hold"
              zIndex={2}
              eventHandlers={imageryEvents}
            />
          )}

          {/* Place names are ours, not the imagery provider's: fixed size,
              fixed wording, switched on at the zoom each one belongs to. */}
          <MapPlaceLabels zoom={currentZoom} />

          <Pane name="countryPane" style={{ zIndex: 360 }}>
            {activeCountryFeature && (
              <GeoJSON
                key={selectedPoint}
                data={activeCountryFeature}
                style={COUNTRY_STYLE}
              />
            )}
          </Pane>

          {/* The Manama-to-Berlin hop, drawn only while the camera travels. */}
          {flightHop && (
            <Pane name="arcPane" style={{ zIndex: 540 }}>
              <Polyline
                positions={arcPoints}
                pathOptions={{
                  className: "bh-arc",
                  color: colors.marker,
                  weight: 2,
                  opacity: 0.75,
                  dashArray: "7 9",
                  lineCap: "round",
                }}
              />
            </Pane>
          )}

          {shouldNeedBerlinOutline && berlinOutline && (
            <Pane name="berlinOutlinePane" style={{ zIndex: 545 }}>
              <GeoJSON data={berlinOutline} style={CITY_OUTLINE_STYLE} />
            </Pane>
          )}

          {shouldNeedFrankfurtOutline && frankfurtOutline && (
            <Pane name="frankfurtOutlinePane" style={{ zIndex: 544 }}>
              <GeoJSON data={frankfurtOutline} style={CITY_OUTLINE_STYLE} />
            </Pane>
          )}

          <Pane name="cityPane" style={{ zIndex: 550 }}>
            {visibleCities.map((city) => {
              if (city.name === WILDAU_NAME) {
                return (
                  <Marker
                    key={city.name}
                    position={city.coordinates}
                    icon={poiIcons.education}
                    eventHandlers={{
                      mouseover: handleWildauHoverStart,
                      mouseout: handleWildauHoverEnd,
                      click: handleWildauClick,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -18]} opacity={1}>
                      <div
                        style={{
                          minWidth: "220px",
                          fontFamily: CARD_FONT,
                          color: "#111827",
                          lineHeight: 1.5,
                        }}
                      >
                        <div style={{ fontSize: "14px", fontWeight: 700 }}>
                          {city.name}
                        </div>
                        <div
                          style={{
                            marginTop: "4px",
                            fontSize: "11px",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: getCategoryColor("education"),
                            fontWeight: 700,
                          }}
                        >
                          {getCategoryLabel("education")}
                        </div>
                      </div>
                    </Tooltip>

                    {city.url && (
                      <Popup>
                        <CityPopupCard city={city} />
                      </Popup>
                    )}
                  </Marker>
                );
              }

              const cityTab = getCityTab(city.name);
              const isHero = sameCoords(city.coordinates, anchorCoords);
              const canDrillIn = Boolean(cityTab) && cityTab !== selectedGermanyPlace;

              const eventHandlers = canDrillIn
                ? { click: () => handleSelectCountry("germany", cityTab) }
                : undefined;

              if (isHero) {
                const heroLabel = isChapterAnchor
                  ? activeLocation.markerLabel || city.name
                  : city.name;

                return (
                  // Distinct from the plain-city key on purpose. A city moves
                  // between this branch and the clickable one as chapters
                  // change, and react-leaflet binds a tooltip's `permanent`
                  // once, when it is created — reusing the element would keep
                  // the hover-only tooltip and the chapter would lose its name.
                  <Marker
                    key={`${city.name}-hero`}
                    position={city.coordinates}
                    icon={heroIcon}
                    zIndexOffset={1000}
                    interactive={canDrillIn}
                    eventHandlers={eventHandlers}
                  >
                    <Tooltip
                      className="bh-label"
                      direction="top"
                      offset={[0, -14]}
                      opacity={1}
                      permanent
                    >
                      {heroLabel}
                    </Tooltip>
                  </Marker>
                );
              }

              return (
                <Marker
                  key={city.name}
                  position={city.coordinates}
                  icon={canDrillIn ? clickableDotIcon : plainDotIcon}
                  eventHandlers={eventHandlers}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    <div
                      style={{
                        fontFamily: CARD_FONT,
                        color: "#111827",
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontSize: "14px", fontWeight: 700 }}>
                        {city.name}
                      </div>
                      {canDrillIn && (
                        <div
                          style={{
                            marginTop: "2px",
                            fontSize: "11px",
                            color: colors.muted,
                            fontWeight: 600,
                          }}
                        >
                          Click to explore
                        </div>
                      )}
                    </div>
                  </Tooltip>

                  {city.url && (
                    <Popup>
                      <CityPopupCard city={city} />
                    </Popup>
                  )}
                </Marker>
              );
            })}

            {/* Bahrain's chapter marker isn't in the city list, so place it here. */}
            {selectedPoint === "bahrain" &&
              !visibleCities.some((city) =>
                sameCoords(city.coordinates, anchorCoords)
              ) && (
                <Marker
                  position={activeLocation.coordinates}
                  icon={heroIcon}
                  zIndexOffset={1000}
                  interactive={false}
                >
                  <Tooltip
                    className="bh-label"
                    direction="top"
                    offset={[0, -14]}
                    opacity={1}
                    permanent
                  >
                    {activeLocation.markerLabel || activeLocation.title}
                  </Tooltip>
                </Marker>
              )}
          </Pane>

          {onBerlinTab && isActive && (
            <Suspense fallback={null}>
              <BerlinUbahnLayer
                visibleLines={visibleLines}
                onStats={handleUbahnStats}
              />
            </Suspense>
          )}

          <Pane name="poiPane" style={{ zIndex: 570 }}>
            {showPois &&
              visiblePois.map((poi) => (
                <Marker
                  key={`${poi.name}-${poi.coordinates[0]}-${poi.coordinates[1]}`}
                  position={poi.coordinates}
                  icon={poiIcons[poi.category] || poiIcons.fun}
                >
                  <Tooltip direction="top" offset={[0, -18]} opacity={1} sticky>
                    <PoiHoverCard poi={poi} />
                  </Tooltip>

                  <Popup>
                    <PoiPopupCard poi={poi} />
                  </Popup>
                </Marker>
              ))}
          </Pane>
        </MapContainer>

        {mapDataError && (
          <div className="bh-map-error" role="status">{mapDataError}</div>
        )}
        {tileStatus === "loading" && (
          <div className="bh-map-loading" role="status">Loading map imagery…</div>
        )}
        {tileStatus === "fallback" && (
          <button className="bh-map-provider" onClick={retrySatellite}>
            Satellite imagery unavailable · Retry
          </button>
        )}

        {onBerlinTab ? (
          <UbahnPanel
            stats={ubahnStats}
            visibleLines={visibleLines}
            onToggleLine={handleToggleLine}
            onSetAll={handleSetAllLines}
          />
        ) : (
          <MapLegend colors={colors} />
        )}

      {onWildauTab && showWildauMap && (
        <ResizableWildauPanel
          colors={colors}
          onMouseEnter={() => setShowWildauMap(true)}
          onMouseLeave={() => {
            if (!wildauMapPinned) setShowWildauMap(false);
          }}
          onClose={() => {
            setWildauMapPinned(false);
            setShowWildauMap(false);
          }}
        />
      )}

    </div>
  );
}

export default memo(JourneyView);
