import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Pane,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import * as turf from "@turf/turf";
import JOURNEY_DATA from "./data/journeyData";

function getCurrentAnchor(selectedPoint, selectedGermanyPlace, locations) {
  if (selectedPoint === "germany") {
    if (selectedGermanyPlace === "wildau") {
      return {
        coordinates: [52.3194, 13.6325],
        bounds: [
          [52.28, 13.58],
          [52.35, 13.69],
        ],
        exploreBounds: [
          [52.25, 13.54],
          [52.38, 13.73],
        ],
      };
    }

    return {
      coordinates: [52.52, 13.405],
      bounds: [
        [52.32, 13.15],
        [52.67, 13.65],
      ],
      exploreBounds: [
        [52.2, 13.0],
        [52.77, 13.78],
      ],
    };
  }

  return locations[selectedPoint];
}

function ChangeMapView({ selectedPoint, selectedGermanyPlace, locations }) {
  const map = useMap();
  const isFirstRender = useRef(true);
  const previousKey = useRef(`${selectedPoint}-${selectedGermanyPlace}`);

  useEffect(() => {
    const target = getCurrentAnchor(selectedPoint, selectedGermanyPlace, locations);
    if (!target) return;

    map.setMaxBounds(target.exploreBounds);

    const nextKey = `${selectedPoint}-${selectedGermanyPlace}`;

    if (isFirstRender.current) {
      map.fitBounds(target.bounds, {
        padding: [56, 56],
        animate: false,
      });
      isFirstRender.current = false;
      previousKey.current = nextKey;
      return;
    }

    if (previousKey.current !== nextKey) {
      map.fitBounds(target.bounds, {
        padding: [56, 56],
        animate: false,
      });
      previousKey.current = nextKey;
    }
  }, [selectedPoint, selectedGermanyPlace, locations, map]);

  return null;
}

function ZoomTracker({ onZoomChange }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function KeepPointCenteredOnZoom({
  selectedPoint,
  selectedGermanyPlace,
  locations,
}) {
  useMapEvents({
    zoomend: (event) => {
      const map = event.target;
      const target = getCurrentAnchor(
        selectedPoint,
        selectedGermanyPlace,
        locations
      );
      if (!target) return;
      map.panTo(target.coordinates, { animate: false });
    },
  });

  return null;
}

function MapZoomControls({
  selectedPoint,
  selectedGermanyPlace,
  locations,
  minZoom,
  maxZoom,
}) {
  const map = useMap();

  const buttonStyle = {
    width: "40px",
    height: "40px",
    border: "1px solid rgba(17,24,39,0.12)",
    background: "rgba(255,255,255,0.92)",
    color: "#111827",
    borderRadius: "14px",
    fontSize: "22px",
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
    backdropFilter: "blur(6px)",
  };

  const handleZoomIn = () => {
    const target = getCurrentAnchor(
      selectedPoint,
      selectedGermanyPlace,
      locations
    );
    if (!target) return;

    const nextZoom = Math.min(maxZoom, map.getZoom() + 1);
    map.setView(target.coordinates, nextZoom, { animate: false });
  };

  const handleZoomOut = () => {
    const target = getCurrentAnchor(
      selectedPoint,
      selectedGermanyPlace,
      locations
    );
    if (!target) return;

    const nextZoom = Math.max(minZoom, map.getZoom() - 1);
    map.setView(target.coordinates, nextZoom, { animate: false });
  };

  return (
    <div
      style={{
        position: "absolute",
        right: "18px",
        bottom: "18px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <button onClick={handleZoomIn} style={buttonStyle} aria-label="Zoom in">
        +
      </button>
      <button onClick={handleZoomOut} style={buttonStyle} aria-label="Zoom out">
        −
      </button>
    </div>
  );
}

function findCountryFeature(data, entry) {
  if (!data?.features) return null;

  return data.features.find((feature) => {
    const props = feature.properties || {};
    const code =
      props.ISO_A3 || props.ISO3166_1_Alpha_3 || props.ADM0_A3 || null;
    const name = props.name || props.NAME || props.ADMIN || null;

    return (
      (code && entry.countryCodes.includes(code)) ||
      (name && entry.countryNames.includes(name))
    );
  });
}

function mergeBerlinDistrictsToOuterBorder(data) {
  if (!data?.features?.length) return null;

  try {
    let merged = data.features[0];

    for (let i = 1; i < data.features.length; i += 1) {
      const next = data.features[i];
      const featureCollection = turf.featureCollection([merged, next]);
      const unioned = turf.union(featureCollection);
      if (unioned) merged = unioned;
    }

    return merged;
  } catch (error) {
    console.error("Error merging Berlin districts:", error);
    return null;
  }
}

function ResizableWildauPanel({
  isDark,
  colors,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) {
  const MIN_WIDTH = 300;
  const MIN_HEIGHT = 220;
  const MAX_WIDTH = 900;
  const MAX_HEIGHT = 700;
  const MARGIN = 16;

  const panelRef = useRef(null);
  const dragRef = useRef(null);

  const [panel, setPanel] = useState({
    top: 16,
    left: 0,
    width: 420,
    height: 280,
    initialized: false,
  });

  useEffect(() => {
    if (panel.initialized) return;
    const parent = panelRef.current?.offsetParent;
    if (!parent) return;

    const parentWidth = parent.clientWidth;
    const initialLeft = Math.max(MARGIN, parentWidth - MARGIN - panel.width);

    setPanel((prev) => ({
      ...prev,
      left: initialLeft,
      initialized: true,
    }));
  }, [panel.initialized, panel.width]);

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

      if (direction.includes("right")) {
        nextWidth = startWidth + dx;
      }

      if (direction.includes("left")) {
        nextWidth = startWidth - dx;
        nextLeft = startLeft + dx;
      }

      if (direction.includes("bottom")) {
        nextHeight = startHeight + dy;
      }

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
        background: isDark ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.97)",
        border: `1px solid ${colors.subtleBorder}`,
        borderRadius: "20px",
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
          background: isDark ? "rgba(255,255,255,0.03)" : "#fafaf9",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700 }}>
            TH Wildau Campus Map
          </div>
          <div style={{ fontSize: "12px", color: colors.muted }}>
            Resize from any side or corner
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            border: `1px solid ${colors.subtleBorder}`,
            background: colors.buttonBg,
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
          title="TH Wildau Campus Map"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          loading="lazy"
        />
      </div>

      <div
        onMouseDown={startResize("top")}
        style={{
          ...handleStyles,
          top: 0,
          left: 12,
          right: 12,
          height: 10,
          cursor: "ns-resize",
        }}
      />
      <div
        onMouseDown={startResize("bottom")}
        style={{
          ...handleStyles,
          bottom: 0,
          left: 12,
          right: 12,
          height: 10,
          cursor: "ns-resize",
        }}
      />
      <div
        onMouseDown={startResize("left")}
        style={{
          ...handleStyles,
          left: 0,
          top: 12,
          bottom: 12,
          width: 10,
          cursor: "ew-resize",
        }}
      />
      <div
        onMouseDown={startResize("right")}
        style={{
          ...handleStyles,
          right: 0,
          top: 12,
          bottom: 12,
          width: 10,
          cursor: "ew-resize",
        }}
      />

      <div
        onMouseDown={startResize("top-left")}
        style={{
          ...handleStyles,
          top: 0,
          left: 0,
          width: 16,
          height: 16,
          cursor: "nwse-resize",
        }}
      />
      <div
        onMouseDown={startResize("top-right")}
        style={{
          ...handleStyles,
          top: 0,
          right: 0,
          width: 16,
          height: 16,
          cursor: "nesw-resize",
        }}
      />
      <div
        onMouseDown={startResize("bottom-left")}
        style={{
          ...handleStyles,
          bottom: 0,
          left: 0,
          width: 16,
          height: 16,
          cursor: "nesw-resize",
        }}
      />
      <div
        onMouseDown={startResize("bottom-right")}
        style={{
          ...handleStyles,
          bottom: 0,
          right: 0,
          width: 16,
          height: 16,
          cursor: "nwse-resize",
        }}
      />
    </div>
  );
}

function App() {
  const [worldData, setWorldData] = useState(null);
  const [detailedCountries, setDetailedCountries] = useState(null);
  const [berlinDistrictsData, setBerlinDistrictsData] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState("germany");
  const [selectedGermanyPlace, setSelectedGermanyPlace] = useState("berlin");
  const [pulse, setPulse] = useState(0);
  const [currentZoom, setCurrentZoom] = useState(5);
  const [theme, setTheme] = useState("light");
  const [showWildauMap, setShowWildauMap] = useState(false);
  const [wildauMapPinned, setWildauMapPinned] = useState(false);

  const minZoom = 5;
  const maxZoom = 9;

  useEffect(() => {
    fetch("/world.geojson")
      .then((response) => response.json())
      .then((data) => setWorldData(data))
      .catch((error) => console.error("Error loading world.geojson:", error));

    fetch("/countries-detailed.geojson")
      .then((response) => response.json())
      .then((data) => setDetailedCountries(data))
      .catch((error) =>
        console.error("Error loading countries-detailed.geojson:", error)
      );

    fetch("/berlin_bezirke.geojson")
      .then((response) => response.json())
      .then((data) => setBerlinDistrictsData(data))
      .catch((error) =>
        console.error("Error loading berlin_bezirke.geojson:", error)
      );
  }, []);

  useEffect(() => {
    let frame;
    let start;

    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const wave = (Math.sin(elapsed / 400) + 1) / 2;
      setPulse(wave);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!(selectedPoint === "germany" && selectedGermanyPlace === "wildau")) {
      setShowWildauMap(false);
      setWildauMapPinned(false);
    }
  }, [selectedPoint, selectedGermanyPlace]);

  const locations = useMemo(() => JOURNEY_DATA, []);
  const activeLocation = locations[selectedPoint];
  const showCityLabels = currentZoom >= 7;

  const zoomProgress = Math.max(
    0,
    Math.min(1, (currentZoom - minZoom) / (maxZoom - minZoom))
  );

  const getCityRadius = (isWildau = false, isActive = false) => {
    if (isActive) {
      return 4 + zoomProgress * 4;
    }

    if (isWildau) {
      return 3 + zoomProgress * 3;
    }

    return 2 + zoomProgress * 2;
  };

  const getMainMarkerRadius = (isActive) => {
    return isActive ? 3 + zoomProgress * 3 : 2 + zoomProgress * 2;
  };

  const getMainHaloRadius = (isActive) => {
    return isActive ? 6 + zoomProgress * 4 + pulse * 2 : 4 + zoomProgress * 2;
  };

  const getHotspotRadius = () => {
    return 8 + zoomProgress * 12;
  };

  const bahrainFeature = useMemo(
    () => findCountryFeature(detailedCountries, locations.bahrain),
    [detailedCountries, locations]
  );

  const germanyFeature = useMemo(
    () => findCountryFeature(detailedCountries, locations.germany),
    [detailedCountries, locations]
  );

  const berlinOuterBorder = useMemo(
    () => mergeBerlinDistrictsToOuterBorder(berlinDistrictsData),
    [berlinDistrictsData]
  );

  const wildauCampusOutline = useMemo(
    () => ({
      type: "Feature",
      properties: { name: "TH Wildau Campus" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [13.6276, 52.3237],
          [13.6308, 52.3239],
          [13.6348, 52.3237],
          [13.6378, 52.3229],
          [13.6398, 52.3217],
          [13.6405, 52.3202],
          [13.6399, 52.3184],
          [13.6383, 52.3171],
          [13.6358, 52.3165],
          [13.6327, 52.3164],
          [13.6298, 52.3169],
          [13.6279, 52.3181],
          [13.6269, 52.3198],
          [13.6268, 52.3218],
          [13.6276, 52.3237],
        ]],
      },
    }),
    []
  );

  const isDark = theme === "dark";

  const colors = {
    pageBg: isDark ? "#0f172a" : "#f5f5f4",
    shellBg: isDark ? "#111827" : "#fafaf9",
    text: isDark ? "#f8fafc" : "#111827",
    muted: isDark ? "#94a3b8" : "#78716c",
    card: isDark ? "#0b1220" : "#ffffff",
    softCard: isDark ? "#111827" : "#fafaf9",
    border: isDark ? "rgba(255,255,255,0.14)" : "#111827",
    subtleBorder: isDark ? "rgba(255,255,255,0.12)" : "#d6d3d1",
    mapBg: isDark ? "#0b1020" : "#fcfcfb",
    worldStroke: isDark ? "rgba(255,255,255,0.16)" : "#d6d3d1",
    worldFill: isDark ? "#111827" : "#f5f5f4",
    inactiveCountryStroke: isDark ? "rgba(255,255,255,0.16)" : "#d6d3d1",
    activeCountryStroke: isDark ? "#e5e7eb" : "#44403c",
    inactiveCountryFill: isDark ? "#162033" : "#f0efec",
    activeCountryFill: isDark ? "#243047" : "#d6d3d1",
    city: isDark ? "#cbd5e1" : "#57534e",
    marker: isDark ? "#f8fafc" : "#111827",
    markerHalo: isDark ? "#f8fafc" : "#292524",
    buttonBg: isDark ? "#0f172a" : "#ffffff",
    buttonActiveBg: isDark ? "#1e293b" : "#e7e5e4",
    infoBorder: isDark ? "rgba(255,255,255,0.1)" : "#e7e5e4",
    outline: isDark ? "#cbd5e1" : "#374151",
    outlineFill: isDark ? "rgba(203,213,225,0.05)" : "rgba(55,65,81,0.03)",
    campusOutline: isDark ? "#93c5fd" : "#2563eb",
    campusFill: isDark ? "rgba(147,197,253,0.10)" : "rgba(37,99,235,0.08)",
  };

  const menuButtonStyle = (isActive) => ({
    padding: "15px 16px",
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "0.01em",
    border: `1px solid ${colors.subtleBorder}`,
    backgroundColor: isActive ? colors.buttonActiveBg : colors.buttonBg,
    color: colors.text,
    cursor: "pointer",
    borderRadius: "18px",
    textAlign: "left",
    transition: "all 0.2s ease",
  });

  const subButtonStyle = (isActive) => ({
    padding: "11px 14px",
    fontSize: "14px",
    fontWeight: 600,
    border: `1px solid ${colors.subtleBorder}`,
    backgroundColor: isActive ? colors.buttonActiveBg : colors.buttonBg,
    color: colors.text,
    cursor: "pointer",
    borderRadius: "14px",
    textAlign: "left",
  });

  const themeButtonStyle = {
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 600,
    border: `1px solid ${colors.subtleBorder}`,
    backgroundColor: colors.buttonBg,
    color: colors.text,
    cursor: "pointer",
    borderRadius: "16px",
  };

  const activeOuterOpacity = 0.05 + pulse * 0.08;

  const handleSelectCountry = (country) => {
    setSelectedPoint(country);
    if (country === "germany") {
      setSelectedGermanyPlace("berlin");
    }
  };

  const handleWildauHoverStart = () => {
    if (selectedPoint === "germany" && selectedGermanyPlace === "wildau") {
      setShowWildauMap(true);
    }
  };

  const handleWildauHoverEnd = () => {
    if (!wildauMapPinned) {
      setShowWildauMap(false);
    }
  };

  const handleWildauClick = () => {
    if (!(selectedPoint === "germany" && selectedGermanyPlace === "wildau")) {
      return;
    }

    if (wildauMapPinned) {
      setWildauMapPinned(false);
      setShowWildauMap(false);
    } else {
      setWildauMapPinned(true);
      setShowWildauMap(true);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: colors.pageBg,
        padding: "22px",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: colors.text,
        transition: "background-color 0.25s ease, color 0.25s ease",
      }}
    >
      <div
        style={{
          minHeight: "calc(100vh - 44px)",
          border: `1px solid ${colors.border}`,
          borderRadius: "28px",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "34px",
          backgroundColor: colors.shellBg,
          boxShadow: isDark
            ? "0 24px 70px rgba(0,0,0,0.38)"
            : "0 24px 70px rgba(15,23,42,0.06)",
          transition: "all 0.25s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              fontWeight: 650,
              letterSpacing: "-0.02em",
            }}
          >
            Basel Hasan
          </div>

          <button
            onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
            style={themeButtonStyle}
          >
            {isDark ? "Switch to Light" : "Switch to Dark"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            gap: "32px",
            alignItems: "start",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              paddingTop: "6px",
            }}
          >
            <button
              onClick={() => handleSelectCountry("bahrain")}
              style={menuButtonStyle(selectedPoint === "bahrain")}
            >
              {locations.bahrain.buttonLabel}
            </button>

            <button
              onClick={() => handleSelectCountry("germany")}
              style={menuButtonStyle(selectedPoint === "germany")}
            >
              {locations.germany.buttonLabel}
            </button>

            {selectedPoint === "germany" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  paddingLeft: "10px",
                  marginTop: "-2px",
                }}
              >
                <button
                  onClick={() => setSelectedGermanyPlace("berlin")}
                  style={subButtonStyle(selectedGermanyPlace === "berlin")}
                >
                  Berlin
                </button>
                <button
                  onClick={() => setSelectedGermanyPlace("wildau")}
                  style={subButtonStyle(selectedGermanyPlace === "wildau")}
                >
                  TH Wildau
                </button>
              </div>
            )}

            <button style={menuButtonStyle(false)}>Resume</button>
            <button style={menuButtonStyle(false)}>Documentation</button>
          </div>

          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: "36px",
              minHeight: "700px",
              background: colors.card,
              padding: "26px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              transition: "all 0.25s ease",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: colors.muted,
                fontWeight: 600,
              }}
            >
              Interactive Journey
            </div>

            <div
              style={{
                overflow: "hidden",
                borderRadius: "30px",
                border: `1px solid ${colors.subtleBorder}`,
                height: "520px",
                background: colors.mapBg,
                position: "relative",
              }}
            >
              <MapContainer
                scrollWheelZoom="center"
                dragging={true}
                doubleClickZoom="center"
                touchZoom="center"
                boxZoom={true}
                keyboard={true}
                zoomControl={false}
                attributionControl={false}
                preferCanvas={true}
                zoomAnimation={false}
                markerZoomAnimation={false}
                fadeAnimation={false}
                maxZoom={maxZoom}
                minZoom={minZoom}
                maxBoundsViscosity={1.0}
                style={{ height: "100%", width: "100%" }}
              >
                <ChangeMapView
                  selectedPoint={selectedPoint}
                  selectedGermanyPlace={selectedGermanyPlace}
                  locations={locations}
                />
                <ZoomTracker onZoomChange={setCurrentZoom} />
                <KeepPointCenteredOnZoom
                  selectedPoint={selectedPoint}
                  selectedGermanyPlace={selectedGermanyPlace}
                  locations={locations}
                />
                <MapZoomControls
                  selectedPoint={selectedPoint}
                  selectedGermanyPlace={selectedGermanyPlace}
                  locations={locations}
                  minZoom={minZoom}
                  maxZoom={maxZoom}
                />

                {worldData && (
                  <GeoJSON
                    data={worldData}
                    style={() => ({
                      color: colors.worldStroke,
                      weight: 0.6,
                      fillColor: colors.worldFill,
                      fillOpacity: 1,
                    })}
                  />
                )}

                {germanyFeature && (
                  <GeoJSON
                    data={germanyFeature}
                    style={() => ({
                      color:
                        selectedPoint === "germany"
                          ? colors.activeCountryStroke
                          : colors.inactiveCountryStroke,
                      weight: selectedPoint === "germany" ? 1.4 : 0.8,
                      fillColor:
                        selectedPoint === "germany"
                          ? colors.activeCountryFill
                          : colors.inactiveCountryFill,
                      fillOpacity: 1,
                    })}
                  />
                )}

                {bahrainFeature && (
                  <GeoJSON
                    data={bahrainFeature}
                    style={() => ({
                      color:
                        selectedPoint === "bahrain"
                          ? colors.activeCountryStroke
                          : colors.inactiveCountryStroke,
                      weight: selectedPoint === "bahrain" ? 1.6 : 0.9,
                      fillColor:
                        selectedPoint === "bahrain"
                          ? colors.activeCountryFill
                          : colors.inactiveCountryFill,
                      fillOpacity: 1,
                    })}
                  />
                )}

                {selectedPoint === "germany" &&
                  selectedGermanyPlace === "berlin" &&
                  berlinOuterBorder && (
                    <Pane name="berlinOutlinePane" style={{ zIndex: 545 }}>
                      <GeoJSON
                        data={berlinOuterBorder}
                        style={() => ({
                          color: colors.outline,
                          weight: 1.6,
                          fillColor: colors.outlineFill,
                          fillOpacity: 1,
                        })}
                      />
                    </Pane>
                  )}

                {selectedPoint === "germany" &&
                  selectedGermanyPlace === "wildau" && (
                    <Pane name="wildauOutlinePane" style={{ zIndex: 546 }}>
                      <GeoJSON
                        data={wildauCampusOutline}
                        style={() => ({
                          color: colors.campusOutline,
                          weight: 1.5,
                          fillColor: colors.campusFill,
                          fillOpacity: 1,
                        })}
                      />
                    </Pane>
                  )}

                <Pane name="cityPane" style={{ zIndex: 550 }}>
                  {activeLocation.cities.map((city) => {
                    const isWildau = city.name === "TH Wildau";
                    const isWildauActive =
                      isWildau &&
                      selectedPoint === "germany" &&
                      selectedGermanyPlace === "wildau";

                    return (
                      <CircleMarker
                        key={city.name}
                        center={city.coordinates}
                        radius={getCityRadius(isWildau, isWildauActive)}
                        pathOptions={{
                          color: isWildau ? colors.campusOutline : colors.city,
                          fillColor: isWildau ? colors.campusOutline : colors.city,
                          fillOpacity: 1,
                          weight: isWildau ? 2 : 1,
                        }}
                        eventHandlers={
                          isWildau
                            ? {
                                mouseover: handleWildauHoverStart,
                                mouseout: handleWildauHoverEnd,
                                click: handleWildauClick,
                              }
                            : undefined
                        }
                      >
                        {showCityLabels && (
                          <Tooltip
                            permanent
                            direction="top"
                            offset={[0, -10]}
                            opacity={1}
                          >
                            {city.name}
                          </Tooltip>
                        )}
                      </CircleMarker>
                    );
                  })}
                </Pane>

                <Pane name="wildauHotspotPane" style={{ zIndex: 610 }}>
                  {selectedPoint === "germany" &&
                    selectedGermanyPlace === "wildau" && (
                      <CircleMarker
                        center={[52.3194, 13.6325]}
                        radius={getHotspotRadius()}
                        pathOptions={{
                          color: colors.campusOutline,
                          fillColor: colors.campusOutline,
                          fillOpacity: 0.08,
                          weight: 2,
                        }}
                        eventHandlers={{
                          mouseover: handleWildauHoverStart,
                          mouseout: handleWildauHoverEnd,
                          click: handleWildauClick,
                        }}
                      />
                    )}
                </Pane>

                <Pane name="customMarkerPane" style={{ zIndex: 600 }}>
                  <CircleMarker
                    center={locations.bahrain.coordinates}
                    radius={getMainHaloRadius(selectedPoint === "bahrain")}
                    pathOptions={{
                      color: colors.markerHalo,
                      weight: 1,
                      fillColor: colors.markerHalo,
                      fillOpacity:
                        selectedPoint === "bahrain" ? activeOuterOpacity : 0.04,
                    }}
                    eventHandlers={{
                      click: () => handleSelectCountry("bahrain"),
                    }}
                  />
                  <CircleMarker
                    center={locations.bahrain.coordinates}
                    radius={getMainMarkerRadius(selectedPoint === "bahrain")}
                    pathOptions={{
                      color: colors.marker,
                      fillColor: colors.marker,
                      fillOpacity: selectedPoint === "bahrain" ? 1 : 0.7,
                    }}
                    eventHandlers={{
                      click: () => handleSelectCountry("bahrain"),
                    }}
                  />

                  <CircleMarker
                    center={locations.germany.coordinates}
                    radius={getMainHaloRadius(selectedPoint === "germany")}
                    pathOptions={{
                      color: colors.markerHalo,
                      weight: 1,
                      fillColor: colors.markerHalo,
                      fillOpacity:
                        selectedPoint === "germany" ? activeOuterOpacity : 0.04,
                    }}
                    eventHandlers={{
                      click: () => handleSelectCountry("germany"),
                    }}
                  />
                  <CircleMarker
                    center={locations.germany.coordinates}
                    radius={getMainMarkerRadius(selectedPoint === "germany")}
                    pathOptions={{
                      color: colors.marker,
                      fillColor: colors.marker,
                      fillOpacity: selectedPoint === "germany" ? 1 : 0.7,
                    }}
                    eventHandlers={{
                      click: () => handleSelectCountry("germany"),
                    }}
                  />
                </Pane>
              </MapContainer>

              {selectedPoint === "germany" &&
                selectedGermanyPlace === "wildau" &&
                showWildauMap && (
                  <ResizableWildauPanel
                    isDark={isDark}
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

            <div
              key={`${selectedPoint}-${selectedGermanyPlace}`}
              style={{
                border: `1px solid ${colors.infoBorder}`,
                borderRadius: "24px",
                padding: "24px",
                background: colors.softCard,
                transition: "all 0.25s ease",
              }}
            >
              <div
                style={{
                  fontSize: "30px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  marginBottom: "10px",
                }}
              >
                {selectedPoint === "germany"
                  ? selectedGermanyPlace === "wildau"
                    ? "TH Wildau"
                    : activeLocation.title
                  : activeLocation.title}
              </div>

              <div
                style={{
                  fontSize: "17px",
                  lineHeight: "1.75",
                  color: isDark ? "#cbd5e1" : "#44403c",
                }}
              >
                {selectedPoint === "germany" && selectedGermanyPlace === "wildau"
                  ? "This is the TH Wildau area. Hover over the large blue marker to open the live map preview, click it to pin the preview open, and resize the preview from any edge or corner."
                  : activeLocation.text}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;