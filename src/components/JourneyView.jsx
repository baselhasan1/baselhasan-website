import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Pane,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import * as turf from "@turf/turf";

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

    if (selectedGermanyPlace === "berlin") {
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

    if (selectedGermanyPlace === "frankfurt") {
      return {
        coordinates: [50.1109, 8.6821],
        bounds: [
          [49.98, 8.45],
          [50.22, 8.92],
        ],
        exploreBounds: [
          [49.9, 8.25],
          [50.3, 9.1],
        ],
      };
    }

    return locations.germany;
  }

  return locations[selectedPoint];
}

function getGermanyFocusPoints(locations) {
  const germanyCities = locations?.germany?.cities || [];

  return germanyCities.filter((city) =>
    [
      "Berlin",
      "Frankfurt",
      "Technical University of Applied Sciences Wildau",
    ].includes(city.name)
  );
}

function getNearestGermanyFocusPoint(referenceLatLng, locations) {
  if (!referenceLatLng) return null;

  const points = getGermanyFocusPoints(locations);
  if (!points.length) return null;

  let nearestPoint = points[0];
  let nearestDistance = Infinity;

  points.forEach((point) => {
    const [lat, lng] = point.coordinates;
    const distance = Math.sqrt(
      (referenceLatLng.lat - lat) ** 2 + (referenceLatLng.lng - lng) ** 2
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPoint = point;
    }
  });

  return nearestPoint;
}

function getZoomTargetCoordinates({
  selectedPoint,
  selectedGermanyPlace,
  locations,
  referenceLatLng,
  fallbackLatLng,
}) {
  if (selectedPoint === "germany" && selectedGermanyPlace === "overview") {
    const nearestPoint = getNearestGermanyFocusPoint(
      referenceLatLng || fallbackLatLng,
      locations
    );

    if (nearestPoint) {
      return nearestPoint.coordinates;
    }
  }

  const target = getCurrentAnchor(selectedPoint, selectedGermanyPlace, locations);
  return target?.coordinates || null;
}

function getVisibleMarkers(selectedPoint, selectedGermanyPlace, locations) {
  if (selectedPoint !== "germany") {
    return locations[selectedPoint]?.cities || [];
  }

  const baseMarkers = locations.germany?.cities || [];
  const pois = locations.germany?.pois || {};

  if (selectedGermanyPlace === "berlin") {
    return [...baseMarkers, ...(pois.berlin || [])];
  }

  if (selectedGermanyPlace === "frankfurt") {
    return [...baseMarkers, ...(pois.frankfurt || [])];
  }

  if (selectedGermanyPlace === "wildau") {
    return [...baseMarkers, ...(pois.wildau || [])];
  }

  return [...baseMarkers, ...(pois.overview || [])];
}

function ChangeMapView({ selectedPoint, selectedGermanyPlace, locations }) {
  const map = useMap();
  const isFirstRender = useRef(true);
  const previousKey = useRef(`${selectedPoint}-${selectedGermanyPlace}`);

  useEffect(() => {
    const target = getCurrentAnchor(
      selectedPoint,
      selectedGermanyPlace,
      locations
    );
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

function MousePositionTracker({ lastPointerLatLngRef }) {
  useMapEvents({
    mousemove: (event) => {
      lastPointerLatLngRef.current = event.latlng;
    },
  });

  return null;
}

function KeepPointCenteredOnZoom({
  selectedPoint,
  selectedGermanyPlace,
  locations,
  lastPointerLatLngRef,
}) {
  useMapEvents({
    zoomend: (event) => {
      const map = event.target;

      const targetCoordinates = getZoomTargetCoordinates({
        selectedPoint,
        selectedGermanyPlace,
        locations,
        referenceLatLng: lastPointerLatLngRef.current,
        fallbackLatLng: map.getCenter(),
      });

      if (!targetCoordinates) return;
      map.panTo(targetCoordinates, { animate: false });
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
  lastPointerLatLngRef,
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
    const nextZoom = Math.min(maxZoom, map.getZoom() + 1);

    const targetCoordinates = getZoomTargetCoordinates({
      selectedPoint,
      selectedGermanyPlace,
      locations,
      referenceLatLng: lastPointerLatLngRef.current,
      fallbackLatLng: map.getCenter(),
    });

    if (!targetCoordinates) return;
    map.setView(targetCoordinates, nextZoom, { animate: false });
  };

  const handleZoomOut = () => {
    const nextZoom = Math.max(minZoom, map.getZoom() - 1);

    const targetCoordinates = getZoomTargetCoordinates({
      selectedPoint,
      selectedGermanyPlace,
      locations,
      referenceLatLng: lastPointerLatLngRef.current,
      fallbackLatLng: map.getCenter(),
    });

    if (!targetCoordinates) return;
    map.setView(targetCoordinates, nextZoom, { animate: false });
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

function mergeDistrictsToOuterBorder(data) {
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
    console.error("Error merging district polygons:", error);
    return null;
  }
}

function ResizableWildauPanel({
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
        background: "rgba(255,255,255,0.97)",
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
          background: "#fafaf9",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700 }}>
            Technical University of Applied Sciences Wildau
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
          title="Technical University of Applied Sciences Wildau map"
          style={{ width: "100%", height: "100%", border: "none" }}
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

function JourneyView({
  selectedPoint,
  selectedGermanyPlace,
  locations,
  handleSelectCountry,
  colors,
  worldData,
  detailedCountries,
}) {
  const [currentZoom, setCurrentZoom] = useState(5);
  const [showWildauMap, setShowWildauMap] = useState(false);
  const [wildauMapPinned, setWildauMapPinned] = useState(false);
  const [berlinDistrictsData, setBerlinDistrictsData] = useState(null);
  const [frankfurtData, setFrankfurtData] = useState(null);
  const [berlinLoaded, setBerlinLoaded] = useState(false);
  const [frankfurtLoaded, setFrankfurtLoaded] = useState(false);

  const lastPointerLatLngRef = useRef(null);

  const minZoom = 5;
  const maxZoom = 11;
  const activeLocation = locations[selectedPoint];
  const visibleMarkers = useMemo(
    () => getVisibleMarkers(selectedPoint, selectedGermanyPlace, locations),
    [selectedPoint, selectedGermanyPlace, locations]
  );

  useEffect(() => {
    if (!(selectedPoint === "germany" && selectedGermanyPlace === "wildau")) {
      setShowWildauMap(false);
      setWildauMapPinned(false);
    }
  }, [selectedPoint, selectedGermanyPlace]);

  const shouldNeedBerlinOutline =
  selectedPoint === "germany" &&
  (selectedGermanyPlace === "berlin" ||
    selectedGermanyPlace === "wildau" ||
    (selectedGermanyPlace === "overview" && currentZoom >= 7));

  const shouldNeedFrankfurtOutline =
    selectedPoint === "germany" &&
    (selectedGermanyPlace === "frankfurt" ||
      (selectedGermanyPlace === "overview" && currentZoom >= 6));

  useEffect(() => {
    if (!shouldNeedBerlinOutline || berlinLoaded) return;

    fetch("/berlin_bezirke.geojson")
      .then((response) => response.json())
      .then((data) => {
        setBerlinDistrictsData(data);
        setBerlinLoaded(true);
      })
      .catch((error) =>
        console.error("Error loading berlin_bezirke.geojson:", error)
      );
  }, [shouldNeedBerlinOutline, berlinLoaded]);

  useEffect(() => {
    if (!shouldNeedFrankfurtOutline || frankfurtLoaded) return;

    fetch("/frankfurt.geojson")
      .then((response) => response.json())
      .then((data) => {
        setFrankfurtData(data);
        setFrankfurtLoaded(true);
      })
      .catch((error) =>
        console.error("Error loading frankfurt.geojson:", error)
      );
  }, [shouldNeedFrankfurtOutline, frankfurtLoaded]);

  const bahrainFeature = useMemo(
    () => findCountryFeature(detailedCountries, locations.bahrain),
    [detailedCountries, locations]
  );

  const germanyFeature = useMemo(
    () => findCountryFeature(detailedCountries, locations.germany),
    [detailedCountries, locations]
  );

  const berlinOuterBorder = useMemo(
    () => mergeDistrictsToOuterBorder(berlinDistrictsData),
    [berlinDistrictsData]
  );

  const frankfurtOuterBorder = useMemo(
    () => mergeDistrictsToOuterBorder(frankfurtData),
    [frankfurtData]
  );

  const zoomProgress = Math.max(
    0,
    Math.min(1, (currentZoom - minZoom) / (maxZoom - minZoom))
  );
  const pulse = (Math.sin(Date.now() / 400) + 1) / 2;
  const activeOuterOpacity = 0.05 + pulse * 0.08;

  const getCityRadius = (isWildau = false, isActive = false) => {
    if (isActive) return 4 + zoomProgress * 4;
    if (isWildau) return 3 + zoomProgress * 3;
    return 2 + zoomProgress * 2;
  };

  const getMainMarkerRadius = (isActive) =>
    isActive ? 3 + zoomProgress * 3 : 2 + zoomProgress * 2;

  const getMainHaloRadius = (isActive) =>
    isActive ? 6 + zoomProgress * 4 + pulse * 2 : 4 + zoomProgress * 2;

  const handleWildauHoverStart = () => {
    if (selectedPoint === "germany" && selectedGermanyPlace === "wildau") {
      setShowWildauMap(true);
    }
  };

  const handleWildauHoverEnd = () => {
    if (!wildauMapPinned) setShowWildauMap(false);
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
        border: `1px solid ${colors.border}`,
        borderRadius: "36px",
        minHeight: "700px",
        background: colors.card,
        padding: "26px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
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
          background: "#fcfcfb",
          position: "relative",
        }}
      >
        <MapContainer
          scrollWheelZoom={true}
          dragging={true}
          doubleClickZoom={true}
          touchZoom={true}
          boxZoom={true}
          keyboard={true}
          zoomControl={false}
          attributionControl={false}
          preferCanvas={false}
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
          <MousePositionTracker lastPointerLatLngRef={lastPointerLatLngRef} />
          <KeepPointCenteredOnZoom
            selectedPoint={selectedPoint}
            selectedGermanyPlace={selectedGermanyPlace}
            locations={locations}
            lastPointerLatLngRef={lastPointerLatLngRef}
          />
          <MapZoomControls
            selectedPoint={selectedPoint}
            selectedGermanyPlace={selectedGermanyPlace}
            locations={locations}
            minZoom={minZoom}
            maxZoom={maxZoom}
            lastPointerLatLngRef={lastPointerLatLngRef}
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

          {selectedPoint === "germany" && germanyFeature && (
            <GeoJSON
              data={germanyFeature}
              style={() => ({
                color: colors.activeCountryStroke,
                weight: 1.4,
                fillColor: colors.activeCountryFill,
                fillOpacity: 1,
              })}
            />
          )}

          {selectedPoint === "bahrain" && bahrainFeature && (
            <GeoJSON
              data={bahrainFeature}
              style={() => ({
                color: colors.activeCountryStroke,
                weight: 1.6,
                fillColor: colors.activeCountryFill,
                fillOpacity: 1,
              })}
            />
          )}

          {selectedPoint === "germany" &&
            shouldNeedBerlinOutline &&
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
            shouldNeedFrankfurtOutline &&
            frankfurtOuterBorder && (
              <Pane name="frankfurtOutlinePane" style={{ zIndex: 544 }}>
                <GeoJSON
                  data={frankfurtOuterBorder}
                  style={() => ({
                    color: colors.outline,
                    weight: 1.6,
                    fillColor: colors.outlineFill,
                    fillOpacity: 1,
                  })}
                />
              </Pane>
            )}

          <Pane name="cityPane" style={{ zIndex: 550 }}>
            {visibleMarkers.map((city) => {
              const isWildau =
                city.name ===
                "Technical University of Applied Sciences Wildau";
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
                      : city.name === "Berlin"
                        ? { click: () => handleSelectCountry("germany", "berlin") }
                        : city.name === "Frankfurt"
                          ? {
                              click: () =>
                                handleSelectCountry("germany", "frankfurt"),
                            }
                          : undefined
                  }
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    {city.name}
                  </Tooltip>

                  {(city.description || city.url) && (
                    <Popup>
                      <div
                        style={{
                          minWidth: "240px",
                          fontFamily:
                            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                          color: "#111827",
                          lineHeight: 1.6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            marginBottom: city.description ? "6px" : "10px",
                          }}
                        >
                          {city.name}
                        </div>

                        {city.description && (
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#44403c",
                              marginBottom: city.url ? "12px" : 0,
                            }}
                          >
                            {city.description}
                          </div>
                        )}

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
                    </Popup>
                  )}
                </CircleMarker>
              );
            })}
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
              eventHandlers={{ click: () => handleSelectCountry("bahrain") }}
            />
            <CircleMarker
              center={locations.bahrain.coordinates}
              radius={getMainMarkerRadius(selectedPoint === "bahrain")}
              pathOptions={{
                color: colors.marker,
                fillColor: colors.marker,
                fillOpacity: selectedPoint === "bahrain" ? 1 : 0.7,
              }}
              eventHandlers={{ click: () => handleSelectCountry("bahrain") }}
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
              eventHandlers={{ click: () => handleSelectCountry("germany") }}
            />
            <CircleMarker
              center={locations.germany.coordinates}
              radius={getMainMarkerRadius(selectedPoint === "germany")}
              pathOptions={{
                color: colors.marker,
                fillColor: colors.marker,
                fillOpacity: selectedPoint === "germany" ? 1 : 0.7,
              }}
              eventHandlers={{ click: () => handleSelectCountry("germany") }}
            />
          </Pane>
        </MapContainer>

        {selectedPoint === "germany" &&
          selectedGermanyPlace === "wildau" &&
          showWildauMap && (
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

      <div
        key={`${selectedPoint}-${selectedGermanyPlace}`}
        style={{
          border: `1px solid ${colors.infoBorder}`,
          borderRadius: "24px",
          padding: "24px",
          background: "#fafaf9",
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
              ? "Technical University of Applied Sciences Wildau"
              : selectedGermanyPlace === "berlin"
                ? "Berlin"
                : selectedGermanyPlace === "frankfurt"
                  ? "Frankfurt"
                  : activeLocation.title
            : activeLocation.title}
        </div>

        <div
          style={{
            fontSize: "17px",
            lineHeight: "1.75",
            color: "#44403c",
          }}
        >
          {selectedPoint === "germany" && selectedGermanyPlace === "wildau"
            ? "I am currently studying Business Informatics at TH Wildau, specializing in Data Engineering and Production Management and Logistics."
            : selectedPoint === "germany" &&
                selectedGermanyPlace === "berlin"
              ? "In 2021, I finally moved to Berlin. I was not originally planning to come to Berlin to pursue my studies, but the universe had other plans, and Berlin slowly became one of the best cities I have ever lived in. Its mix of cultures and its down-to-earth people made me see the city as my second home."
              : selectedPoint === "germany" &&
                  selectedGermanyPlace === "frankfurt"
                ? "I can confidently say that Frankfurt holds a special place in my heart. I often visited Frankfurt during the holidays with my family, and in 2018 and 2019, I had the opportunity to attend a German summer course there. During that time, I also learned how to live independently and take responsibility for myself at a relatively young age."
                : activeLocation.text}
        </div>
      </div>
    </div>
  );
}

export default memo(JourneyView);