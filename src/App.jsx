import { useCallback, useEffect, useMemo, useState } from "react";
import IntroScreen from "./components/IntroScreen.jsx";
import JourneyView from "./components/JourneyView.jsx";
import ResumeView from "./components/ResumeView.jsx";
import ContactView from "./components/ContactView.jsx";
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

  const topRightButtonStyle = {
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 700,
    border: `1px solid ${colors.subtleBorder}`,
    backgroundColor: colors.buttonBg,
    color: colors.text,
    cursor: "pointer",
    borderRadius: "16px",
  };

  const brandStyle = {
    fontSize: "28px",
    fontWeight: 650,
    letterSpacing: "-0.02em",
    cursor: "pointer",
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
            transform: "scale(0.92)",
            transformOrigin: "top center",
            width: "108.7%",
            marginLeft: "-4.35%",
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

              <button
                onClick={() => setShowBugModal(true)}
                style={topRightButtonStyle}
              >
                Report Bug
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
                  style={menuButtonStyle(
                    activeSection === "journey" && selectedPoint === "bahrain"
                  )}
                >
                  {locations.bahrain.buttonLabel}
                </button>

                <button
                  onClick={() => handleSelectCountry("germany")}
                  style={menuButtonStyle(
                    activeSection === "journey" && selectedPoint === "germany"
                  )}
                >
                  {locations.germany.buttonLabel}
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
                      style={subButtonStyle(selectedGermanyPlace === "frankfurt")}
                    >
                      Frankfurt
                    </button>

                    <button
                      onClick={() => {
                        setSelectedGermanyPlace("berlin");
                        resetJourneyView();
                      }}
                      style={subButtonStyle(selectedGermanyPlace === "berlin")}
                    >
                      Berlin
                    </button>

                    <button
                      onClick={() => {
                        setSelectedGermanyPlace("wildau");
                        resetJourneyView();
                      }}
                      style={subButtonStyle(selectedGermanyPlace === "wildau")}
                    >
                      TH Wildau
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setActiveSection("resume")}
                  style={menuButtonStyle(activeSection === "resume")}
                >
                  Resume
                </button>

                <button
                  onClick={() => setActiveSection("contact")}
                  style={menuButtonStyle(activeSection === "contact")}
                >
                  Contact
                </button>
              </div>

              {activeSection === "resume" ? (
                <ResumeView colors={colors} />
              ) : activeSection === "contact" ? (
                <ContactView colors={colors} />
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

      <BugReportModal
        isOpen={showBugModal}
        onClose={() => setShowBugModal(false)}
        colors={colors}
      />
    </>
  );
}

export default App;