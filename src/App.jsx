import { useCallback, useEffect, useMemo, useState } from "react";
import IntroScreen from "./components/IntroScreen.jsx";
import JourneyView from "./components/JourneyView.jsx";
import ResumeView from "./components/ResumeView.jsx";
import ContactView from "./components/ContactView.jsx";
import AnalyticsView from "./components/AnalyticsView.jsx";
import BugReportModal from "./components/BugReportModal.jsx";
import JOURNEY_DATA from "./data/journeyData.js";

function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [activeSection, setActiveSection] = useState("journey");
  const [selectedPoint, setSelectedPoint] = useState("bahrain");
  const [selectedGermanyPlace, setSelectedGermanyPlace] = useState("overview");
  const [journeyResetKey, setJourneyResetKey] = useState(0);
  const [journeyViewKey, setJourneyViewKey] = useState(0);
  const [showBugModal, setShowBugModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [worldData, setWorldData] = useState(null);
  const [detailedCountries, setDetailedCountries] = useState(null);

  const [hoveredMainButton, setHoveredMainButton] = useState(null);
  const [hoveredSubButton, setHoveredSubButton] = useState(null);
  const [isBugHovered, setIsBugHovered] = useState(false);
  const [isContactHovered, setIsContactHovered] = useState(false);

  const [contentVisible, setContentVisible] = useState(true);

  const locations = useMemo(() => JOURNEY_DATA, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

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
  }, []);

  useEffect(() => {
    setContentVisible(false);
    const timer = setTimeout(() => setContentVisible(true), 35);

    return () => clearTimeout(timer);
  }, [activeSection, selectedPoint, selectedGermanyPlace, journeyViewKey]);

  const colors = {
    pageBg: "#f5f5f4",
    shellBg: "#fafaf9",
    text: "#111827",
    muted: "#78716c",
    card: "#ffffff",
    softCard: "#fafaf9",
    border: "#111827",
    subtleBorder: "#d6d3d1",
    mapBg: "#fcfcfb",
    worldStroke: "#d6d3d1",
    worldFill: "#f5f5f4",
    inactiveCountryStroke: "#d6d3d1",
    activeCountryStroke: "#44403c",
    inactiveCountryFill: "#f0efec",
    activeCountryFill: "#d6d3d1",
    city: "#57534e",
    marker: "#111827",
    markerHalo: "#292524",
    buttonBg: "#ffffff",
    buttonActiveBg: "#e7e5e4",
    infoBorder: "#e7e5e4",
    outline: "#374151",
    outlineFill: "rgba(55,65,81,0.03)",
    campusOutline: "#2563eb",
    campusFill: "rgba(37,99,235,0.08)",
  };

  const handleIntroFinish = useCallback(() => {
    setShowIntro(false);
  }, []);

  const resetJourneyView = useCallback(() => {
    setJourneyViewKey((prev) => prev + 1);
  }, []);

  const openJourneyDefault = useCallback(() => {
    setActiveSection("journey");
    setSelectedPoint("bahrain");
    setSelectedGermanyPlace("overview");
    setJourneyResetKey((prev) => prev + 1);
    setJourneyViewKey((prev) => prev + 1);
  }, []);

  const handleSelectCountry = (country, germanyPlaceOverride = null) => {
    setActiveSection("journey");
    setSelectedPoint(country);

    if (country === "germany") {
      setSelectedGermanyPlace(germanyPlaceOverride || "overview");
    } else {
      setSelectedGermanyPlace("overview");
    }

    resetJourneyView();
  };

  const handleNavigateToSection = useCallback((section) => {
    setActiveSection(section);
  }, []);

  const handleContactClick = useCallback(() => {
    window.location.href =
      "mailto:baselkadhem@icloud.com";
  }, []);

  useEffect(() => {
    if (activeSection !== "journey") return;
    if (selectedPoint !== "germany") return;

    if (
      selectedGermanyPlace !== "overview" &&
      selectedGermanyPlace !== "berlin" &&
      selectedGermanyPlace !== "frankfurt" &&
      selectedGermanyPlace !== "wildau"
    ) {
      setSelectedGermanyPlace("overview");
    }
  }, [activeSection, selectedPoint, selectedGermanyPlace]);

  const menuButtonStyle = (isActive, isHovered) => ({
    width: "100%",
    padding: "15px 16px",
    fontSize: "15px",
    fontWeight: 650,
    letterSpacing: "0.01em",
    border: `1.5px solid ${
      isActive ? colors.border : isHovered ? "#a8a29e" : colors.subtleBorder
    }`,
    backgroundColor: isActive
      ? colors.buttonActiveBg
      : isHovered
        ? "#f8f7f5"
        : colors.buttonBg,
    color: colors.text,
    cursor: "pointer",
    borderRadius: "18px",
    textAlign: "left",
    transition:
      "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background-color 0.16s ease",
    boxShadow: isActive
      ? "inset 0 1px 2px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)"
      : isHovered
        ? "0 8px 18px rgba(0,0,0,0.07)"
        : "0 2px 6px rgba(0,0,0,0.04)",
    transform: isHovered && !isActive ? "translateY(-1px)" : "translateY(0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  });

  const subButtonStyle = (isActive, isHovered) => ({
    width: "100%",
    padding: "11px 14px",
    fontSize: "14px",
    fontWeight: 650,
    border: `1.5px solid ${
      isActive ? colors.border : isHovered ? "#a8a29e" : colors.subtleBorder
    }`,
    backgroundColor: isActive
      ? colors.buttonActiveBg
      : isHovered
        ? "#f8f7f5"
        : colors.buttonBg,
    color: colors.text,
    cursor: "pointer",
    borderRadius: "14px",
    textAlign: "left",
    transition:
      "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background-color 0.16s ease",
    boxShadow: isActive
      ? "inset 0 1px 2px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)"
      : isHovered
        ? "0 8px 18px rgba(0,0,0,0.07)"
        : "0 2px 6px rgba(0,0,0,0.04)",
    transform: isHovered && !isActive ? "translateY(-1px)" : "translateY(0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  });

  const createTopRightButtonStyle = (isHovered, isPrimary = false) => ({
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: isPrimary ? 800 : 700,
    border: `1.5px solid ${
      isPrimary
        ? colors.border
        : isHovered
          ? "#a8a29e"
          : colors.subtleBorder
    }`,
    backgroundColor: isHovered ? "#f8f7f5" : colors.buttonBg,
    color: colors.text,
    cursor: "pointer",
    borderRadius: "16px",
    transition:
      "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background-color 0.16s ease",
    boxShadow: isHovered
      ? "0 8px 18px rgba(0,0,0,0.07)"
      : "0 2px 6px rgba(0,0,0,0.04)",
    transform: isHovered ? "translateY(-1px)" : "translateY(0)",
  });

  const brandStyle = {
    fontSize: "28px",
    fontWeight: 650,
    letterSpacing: "-0.02em",
    cursor: "pointer",
  };

  const navIndicatorStyle = (isActive) => ({
    fontSize: "16px",
    fontWeight: 700,
    color: isActive ? colors.text : "#a8a29e",
    opacity: isActive ? 1 : 0.75,
    flexShrink: 0,
  });

  const contentTransitionStyle = {
    opacity: contentVisible ? 1 : 0,
    transform: contentVisible ? "translateY(0)" : "translateY(10px)",
    transition: "opacity 220ms ease, transform 220ms ease",
    willChange: "opacity, transform",
    minWidth: 0,
  };

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
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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

  if (showIntro) {
    return <IntroScreen onFinish={handleIntroFinish} />;
  }

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: colors.pageBg,
          padding: "22px",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: colors.text,
          overflowX: "hidden",
        }}
      >
        <div
          style={{
            transform: "scale(0.90)",
            transformOrigin: "top center",
            width: "111.11%",
            marginLeft: "-5.55%",
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
              boxShadow: "0 24px 70px rgba(15,23,42,0.06)",
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
              <div onClick={openJourneyDefault} style={brandStyle}>
                Basel Hasan
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <button
                  onClick={handleContactClick}
                  onMouseEnter={() => setIsContactHovered(true)}
                  onMouseLeave={() => setIsContactHovered(false)}
                  style={createTopRightButtonStyle(isContactHovered, true)}
                >
                  Contact Me
                </button>

                <button
                  onClick={() => setShowBugModal(true)}
                  onMouseEnter={() => setIsBugHovered(true)}
                  onMouseLeave={() => setIsBugHovered(false)}
                  style={createTopRightButtonStyle(isBugHovered)}
                >
                  Report Bug
                </button>
              </div>
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
                  onMouseEnter={() => setHoveredMainButton("bahrain")}
                  onMouseLeave={() => setHoveredMainButton(null)}
                  style={menuButtonStyle(
                    activeSection === "journey" && selectedPoint === "bahrain",
                    hoveredMainButton === "bahrain"
                  )}
                >
                  <span>{locations.bahrain.buttonLabel}</span>
                  <span
                    style={navIndicatorStyle(
                      activeSection === "journey" && selectedPoint === "bahrain"
                    )}
                  >
                    ›
                  </span>
                </button>

                <button
                  onClick={() => handleSelectCountry("germany")}
                  onMouseEnter={() => setHoveredMainButton("germany")}
                  onMouseLeave={() => setHoveredMainButton(null)}
                  style={menuButtonStyle(
                    activeSection === "journey" && selectedPoint === "germany",
                    hoveredMainButton === "germany"
                  )}
                >
                  <span>{locations.germany.buttonLabel}</span>
                  <span
                    style={navIndicatorStyle(
                      activeSection === "journey" && selectedPoint === "germany"
                    )}
                  >
                    ›
                  </span>
                </button>

                {activeSection === "journey" && selectedPoint === "germany" && (
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
                      onClick={() => {
                        setSelectedGermanyPlace("frankfurt");
                        resetJourneyView();
                      }}
                      onMouseEnter={() => setHoveredSubButton("frankfurt")}
                      onMouseLeave={() => setHoveredSubButton(null)}
                      style={subButtonStyle(
                        selectedGermanyPlace === "frankfurt",
                        hoveredSubButton === "frankfurt"
                      )}
                    >
                      <span>Frankfurt</span>
                      <span
                        style={navIndicatorStyle(
                          selectedGermanyPlace === "frankfurt"
                        )}
                      >
                        ›
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedGermanyPlace("berlin");
                        resetJourneyView();
                      }}
                      onMouseEnter={() => setHoveredSubButton("berlin")}
                      onMouseLeave={() => setHoveredSubButton(null)}
                      style={subButtonStyle(
                        selectedGermanyPlace === "berlin",
                        hoveredSubButton === "berlin"
                      )}
                    >
                      <span>Berlin</span>
                      <span
                        style={navIndicatorStyle(
                          selectedGermanyPlace === "berlin"
                        )}
                      >
                        ›
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedGermanyPlace("wildau");
                        resetJourneyView();
                      }}
                      onMouseEnter={() => setHoveredSubButton("wildau")}
                      onMouseLeave={() => setHoveredSubButton(null)}
                      style={subButtonStyle(
                        selectedGermanyPlace === "wildau",
                        hoveredSubButton === "wildau"
                      )}
                    >
                      <span>Technical University of Applied Sciences Wildau</span>
                      <span
                        style={navIndicatorStyle(
                          selectedGermanyPlace === "wildau"
                        )}
                      >
                        ›
                      </span>
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setActiveSection("resume")}
                  onMouseEnter={() => setHoveredMainButton("resume")}
                  onMouseLeave={() => setHoveredMainButton(null)}
                  style={menuButtonStyle(
                    activeSection === "resume",
                    hoveredMainButton === "resume"
                  )}
                >
                  <span>Resume</span>
                  <span style={navIndicatorStyle(activeSection === "resume")}>
                    ›
                  </span>
                </button>

                <button
                  onClick={() => setActiveSection("contact")}
                  onMouseEnter={() => setHoveredMainButton("contact")}
                  onMouseLeave={() => setHoveredMainButton(null)}
                  style={menuButtonStyle(
                    activeSection === "contact",
                    hoveredMainButton === "contact"
                  )}
                >
                  <span>Contact</span>
                  <span style={navIndicatorStyle(activeSection === "contact")}>
                    ›
                  </span>
                </button>

                <button
                  onClick={() => setActiveSection("analytics")}
                  onMouseEnter={() => setHoveredMainButton("analytics")}
                  onMouseLeave={() => setHoveredMainButton(null)}
                  style={menuButtonStyle(
                    activeSection === "analytics",
                    hoveredMainButton === "analytics"
                  )}
                >
                  <span>Analytics</span>
                  <span style={navIndicatorStyle(activeSection === "analytics")}>
                    ›
                  </span>
                </button>
              </div>

              <div style={contentTransitionStyle}>
                {activeSection === "resume" ? (
                  <ResumeView
                    colors={colors}
                    onNavigateToSection={handleNavigateToSection}
                  />
                ) : activeSection === "contact" ? (
                  <ContactView colors={colors} />
                ) : activeSection === "analytics" ? (
                  <AnalyticsView colors={colors} />
                ) : (
                  <JourneyView
                    key={`${journeyResetKey}-${journeyViewKey}`}
                    selectedPoint={selectedPoint}
                    selectedGermanyPlace={selectedGermanyPlace}
                    locations={locations}
                    handleSelectCountry={handleSelectCountry}
                    colors={colors}
                    worldData={worldData}
                    detailedCountries={detailedCountries}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BugReportModal
        isOpen={showBugModal}
        onClose={() => setShowBugModal(false)}
        colors={colors}
      />
    </>
  );
}

export default App;