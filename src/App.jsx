import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import AnalyticsView from "./components/AnalyticsView.jsx";
import BugReportModal from "./components/BugReportModal.jsx";
import ContactView from "./components/ContactView.jsx";
import IntroScreen from "./components/IntroScreen.jsx";
import JourneyView from "./components/JourneyView.jsx";
import OverlayPanel from "./components/OverlayPanel.jsx";
import ResumeView from "./components/ResumeView.jsx";
import JOURNEY_DATA from "./data/journeyData.js";
import { loadGeoJson } from "./utils/loadGeoJson.js";
import { usePresence } from "./utils/motion.js";

const FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const GERMANY_PLACES = [
  { id: "overview", label: "Overview" },
  { id: "frankfurt", label: "Frankfurt" },
  { id: "berlin", label: "Berlin" },
  { id: "wildau", label: "TH Wildau" },
];

const PANEL_TITLES = {
  resume: "Resume",
  contact: "Contact",
  analytics: "Analytics",
};

// Matches the .bh-overlay closing animation in index.css.
const PANEL_EXIT_MS = 180;

const COLORS = {
  pageBg: "#f5f5f4",
  shellBg: "#fafaf9",
  text: "#111827",
  muted: "#78716c",
  card: "#ffffff",
  border: "#111827",
  subtleBorder: "#d6d3d1",
  marker: "#111827",
  buttonBg: "#ffffff",
  buttonActiveBg: "#e7e5e4",
};

// The section panels are bundled in rather than lazy-loaded. Together they
// are ~6 KiB gzip, and lazy() cost far more than that in feel: React holds a
// suspended view back for ~300 ms before revealing it, so every first open
// showed "Loading…" and then popped.

function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState("bahrain");
  const [selectedGermanyPlace, setSelectedGermanyPlace] = useState("overview");
  const [openPanel, setOpenPanel] = useState(null);
  const [showBugModal, setShowBugModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [focusCountries, setFocusCountries] = useState(null);
  const [mapDataError, setMapDataError] = useState(null);

  const [shownPanel, isPanelClosing] = usePresence(openPanel, PANEL_EXIT_MS);

  const navRef = useRef(null);
  const navPillRef = useRef(null);

  const locations = useMemo(() => JOURNEY_DATA, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Starts while the intro is still typing, so the map is ready the moment it
  // clears rather than only beginning to load then.
  useEffect(() => {
    if (isMobile) return undefined;

    const controller = new AbortController();
    loadGeoJson("geo/focus-countries.geojson", { signal: controller.signal })
      .then((data) => {
        setFocusCountries(data);
        setMapDataError(null);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Error loading focus-countries.geojson:", error);
        setMapDataError("The map outline could not be loaded.");
      });

    return () => controller.abort();
  }, [isMobile]);

  const colors = COLORS;

  const handleIntroFinish = useCallback(() => setShowIntro(false), []);

  const handleSelectCountry = useCallback((country, germanyPlaceOverride = null) => {
    setOpenPanel(null);
    setSelectedPoint(country);
    setSelectedGermanyPlace(
      country === "germany" ? germanyPlaceOverride || "overview" : "overview"
    );
  }, []);

  const openJourneyDefault = useCallback(() => {
    setOpenPanel(null);
    setSelectedPoint("bahrain");
    setSelectedGermanyPlace("overview");
  }, []);

  const handleContactClick = useCallback(() => {
    window.location.href = "mailto:baselkadhem@icloud.com";
  }, []);

  useEffect(() => {
    if (!openPanel) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape") setOpenPanel(null);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel]);

  /* --- floating chrome styles ------------------------------------------ */

  // Glass surfaces get their background, border and shadow from the .bh-glass
  // class — setting those inline here would paint over the blur.
  const subChipStyle = {
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 650,
    borderRadius: "999px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const actionButtonStyle = (isPrimary = false) => ({
    padding: "11px 16px",
    fontSize: "13.5px",
    fontWeight: isPrimary ? 800 : 700,
    borderRadius: "14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const onJourney = openPanel === null;

  const navItems = [
    {
      id: "bahrain",
      label: "Bahrain",
      isActive: onJourney && selectedPoint === "bahrain",
      onClick: () => handleSelectCountry("bahrain"),
    },
    {
      id: "germany",
      label: "Germany",
      isActive: onJourney && selectedPoint === "germany",
      onClick: () => handleSelectCountry("germany"),
    },
    {
      id: "resume",
      label: "Resume",
      isActive: openPanel === "resume",
      onClick: () => setOpenPanel("resume"),
    },
    {
      id: "contact",
      label: "Contact",
      isActive: openPanel === "contact",
      onClick: () => setOpenPanel("contact"),
    },
    {
      id: "analytics",
      label: "Analytics",
      isActive: openPanel === "analytics",
      onClick: () => setOpenPanel("analytics"),
    },
  ];

  const activeNavId = navItems.find((item) => item.isActive)?.id ?? null;

  // One highlight that slides between tabs instead of each tab painting its
  // own. Positioned imperatively so a tab change costs no extra render.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = navPillRef.current;
    if (!nav || !pill) return undefined;

    const place = () => {
      const button = activeNavId && nav.querySelector(`[data-nav-id="${activeNavId}"]`);
      if (!button) {
        pill.style.opacity = "0";
        return;
      }
      pill.style.opacity = "1";
      pill.style.width = `${button.offsetWidth}px`;
      pill.style.transform = `translateX(${button.offsetLeft}px)`;
    };

    place();
    // Only animate moves after the first placement, so it doesn't fly in from
    // the left edge on load.
    const frame = requestAnimationFrame(() => {
      pill.dataset.ready = "true";
    });

    // Web fonts arriving change tab widths.
    const observer = new ResizeObserver(place);
    observer.observe(nav);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [activeNavId, isMobile]);

  if (isMobile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
          boxSizing: "border-box",
          textAlign: "center",
          fontFamily: FONT_STACK,
          color: "#111827",
        }}
      >
        <div
          style={{
            fontSize: "clamp(24px, 6vw, 34px)",
            fontWeight: 600,
            lineHeight: 1.5,
            maxWidth: "420px",
          }}
        >
          For a better experience, open the site on your computer :)
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        backgroundColor: colors.pageBg,
        fontFamily: FONT_STACK,
        color: colors.text,
      }}
    >
      <JourneyView
        selectedPoint={selectedPoint}
        selectedGermanyPlace={selectedGermanyPlace}
        locations={locations}
        handleSelectCountry={handleSelectCountry}
        colors={colors}
        focusCountries={focusCountries}
        mapDataError={mapDataError}
        isActive={!openPanel}
      />

      {/* Floating chrome. The bar itself ignores pointer events so the map
          stays draggable everywhere between the controls. */}
      <header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1500,
          display: "flex",
          alignItems: "flex-start",
          gap: "20px",
          padding: "20px 24px",
          pointerEvents: "none",
        }}
      >
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
          <button
            onClick={openJourneyDefault}
            className="bh-glass bh-glass--btn"
            style={{
              pointerEvents: "auto",
              padding: "11px 18px",
              borderRadius: "16px",
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              cursor: "pointer",
            }}
          >
            Basel Hasan
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            pointerEvents: "auto",
          }}
        >
          <nav ref={navRef} className="bh-glass bh-nav">
            <span ref={navPillRef} className="bh-nav-pill" aria-hidden="true" />
            {navItems.map((item) => (
              <button
                key={item.id}
                data-nav-id={item.id}
                onClick={item.onClick}
                className={`bh-nav-item ${item.isActive ? "is-active" : ""}`}
                aria-current={item.isActive ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {onJourney && selectedPoint === "germany" && (
            <div
              className="bh-subtabs"
              style={{ display: "flex", gap: "8px", justifyContent: "center" }}
            >
              {GERMANY_PLACES.map((place) => (
                <button
                  key={place.id}
                  onClick={() => setSelectedGermanyPlace(place.id)}
                  className={`bh-glass bh-glass--btn ${
                    selectedGermanyPlace === place.id ? "is-active" : ""
                  }`}
                  style={subChipStyle}
                >
                  {place.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "flex-start",
            gap: "10px",
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={handleContactClick}
            className="bh-glass bh-glass--btn is-primary"
            style={actionButtonStyle(true)}
          >
            Contact Me
          </button>

          <button
            onClick={() => setShowBugModal(true)}
            className="bh-glass bh-glass--btn"
            style={actionButtonStyle()}
          >
            Report Bug
          </button>
        </div>
      </header>

      {shownPanel && (
        <OverlayPanel
          title={PANEL_TITLES[shownPanel]}
          colors={colors}
          isClosing={isPanelClosing}
          onClose={() => setOpenPanel(null)}
        >
          {shownPanel === "resume" && <ResumeView colors={colors} />}
          {shownPanel === "contact" && <ContactView colors={colors} />}
          {shownPanel === "analytics" && <AnalyticsView colors={colors} />}
        </OverlayPanel>
      )}

      <BugReportModal
        isOpen={showBugModal}
        onClose={() => setShowBugModal(false)}
        colors={colors}
      />

      {/* The site loads underneath while this plays. */}
      {showIntro && <IntroScreen onFinish={handleIntroFinish} />}
    </div>
  );
}

export default App;
