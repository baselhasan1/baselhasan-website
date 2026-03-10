import { memo, useState } from "react";

function ResumeView({ colors }) {
  const [showVehiclePreview, setShowVehiclePreview] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const sectionTitleStyle = {
    fontSize: "20px",
    fontWeight: 800,
    letterSpacing: "-0.01em",
    marginBottom: "12px",
  };

  const bodyStyle = {
    fontSize: "16px",
    lineHeight: "1.55",
    color: "#1f2937",
  };

  const bulletListStyle = {
    margin: 0,
    paddingLeft: "22px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    ...bodyStyle,
  };

  const pageStyle = {
    width: "100%",
    maxWidth: "920px",
    margin: "0 auto",
    background: "#ffffff",
    border: `1px solid ${colors.subtleBorder}`,
    borderRadius: "8px",
    padding: "56px 56px 48px",
    boxShadow: "0 20px 50px rgba(15,23,42,0.08)",
  };

  const hoverCardStyle = {
    position: "absolute",
    top: "42px",
    left: "0",
    width: "380px",
    padding: "14px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.98)",
    border: `1px solid ${colors.subtleBorder}`,
    boxShadow: "0 20px 45px rgba(0,0,0,0.18)",
    zIndex: 100,
    backdropFilter: "blur(8px)",
  };

  const imageStyle = {
    width: "100%",
    height: "220px",
    objectFit: "contain",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: `1px solid ${colors.subtleBorder}`,
  };

  const modalOverlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 9999,
  };

  const modalCardStyle = {
    width: "min(92vw, 1000px)",
    maxHeight: "90vh",
    background: "#ffffff",
    border: `1px solid ${colors.subtleBorder}`,
    borderRadius: "22px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const modalImageStyle = {
    width: "100%",
    height: "auto",
    maxHeight: "78vh",
    objectFit: "contain",
    backgroundColor: "#f8fafc",
  };

  return (
    <>
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
          Resume
        </div>

        <div
          style={{
            overflow: "auto",
            borderRadius: "30px",
            border: `1px solid ${colors.subtleBorder}`,
            minHeight: "520px",
            background: "#fcfcfb",
            padding: "28px",
          }}
        >
          <div style={pageStyle}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "260px 1fr",
                gap: "52px",
                alignItems: "start",
              }}
            >
              <div />

              <div>
                <div
                  style={{
                    fontSize: "56px",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    marginBottom: "10px",
                  }}
                >
                  BASEL HASAN
                </div>
                <div
                  style={{
                    fontSize: "30px",
                    fontWeight: 400,
                    color: "#111827",
                  }}
                >
                  Student at TH Wildau
                </div>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: "34px" }}
              >
                <section>
                  <div style={sectionTitleStyle}>CONTACT</div>
                  <div style={bodyStyle}>
                    <div>baselkadhem@icloud.com</div>
                    <div>+49 176 72982405</div>
                    <div>15745, Wildau</div>
                  </div>
                </section>

                <section>
                  <div style={sectionTitleStyle}>SKILLS</div>
                  <ul style={bulletListStyle}>
                    <li>C#, SQL, Java, Python</li>
                    <li>Power BI, Tableau</li>
                  </ul>
                </section>

                <section>
                  <div style={sectionTitleStyle}>EDUCATION</div>
                  <div style={bodyStyle}>
                    <div style={{ fontWeight: 700, fontSize: "18px" }}>
                      Bachelor’s Degree in Business Informatics
                    </div>
                    <div style={{ marginTop: "10px", fontStyle: "italic" }}>
                      Technical University of Applied Sciences Wildau
                    </div>
                    <div style={{ fontStyle: "italic" }}>
                      September 2023 - Today
                    </div>
                  </div>
                </section>

                <section>
                  <div style={sectionTitleStyle}>LANGUAGES</div>
                  <ul style={bulletListStyle}>
                    <li>English (Fluent)</li>
                    <li>German (Fluent)</li>
                    <li>Arabic (Mother Tongue)</li>
                  </ul>
                </section>

                <section>
                  <div style={sectionTitleStyle}>LIBRARIES & FRAMEWORKS</div>
                  <ul style={bulletListStyle}>
                    <li>Spring boot, REST APIs</li>
                    <li>NumPy, MatplotLib, pandas</li>
                  </ul>
                </section>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: "34px" }}
              >
                <section>
                  <div style={sectionTitleStyle}>PROFESSIONAL SUMMARY</div>
                  <div style={bodyStyle}>
                    Curious and detail-oriented Business Informatics student from
                    Bahrain specializing in Data Engineering and Production
                    Management and Logistics, with a strong interest in AI
                    automation, analytics, and finance. Experienced as a
                    freelance producer, demonstrating creativity,
                    self-management, and project ownership alongside academic
                    studies.
                  </div>
                </section>

                <section>
                  <div style={sectionTitleStyle}>PROJECTS</div>

                  <div style={{ ...bodyStyle, marginBottom: "28px" }}>
                    <div style={{ fontWeight: 800, fontSize: "17px" }}>
                      Software Development - Secret Santa API
                    </div>
                    <div style={{ fontStyle: "italic", marginTop: "4px" }}>
                      Project within studies
                    </div>
                    <ul style={{ ...bulletListStyle, marginTop: "12px" }}>
                      <li>
                        Designed and developed a RESTful backend architecture for
                        a gift exchange system.
                      </li>
                      <li>
                        Implemented user authentication, logic and randomized
                        algorithms via REST APIs.
                      </li>
                      <li>
                        Integrated relational database persistence with
                        structured error handling and HTTP status codes.
                      </li>
                    </ul>
                  </div>

                  <div style={bodyStyle}>
                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                      }}
                      onMouseEnter={() => setShowVehiclePreview(true)}
                      onMouseLeave={() => setShowVehiclePreview(false)}
                    >
                      <div
                        onClick={() => setShowVehicleModal(true)}
                        style={{
                          fontWeight: 800,
                          fontSize: "17px",
                          cursor: "pointer",
                          textDecoration: "underline",
                          textDecorationThickness: "1px",
                          textUnderlineOffset: "4px",
                        }}
                      >
                        Autonomus Wireless Charging Vehicle
                      </div>

                      {showVehiclePreview && (
                        <div style={hoverCardStyle}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              marginBottom: "10px",
                              color: colors.muted,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                            }}
                          >
                            Project Preview
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr",
                              gap: "10px",
                            }}
                          >
                            <img
                              src="/resume/autonomous-vehicle/preview.png"
                              alt="Autonomous vehicle preview"
                              style={imageStyle}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ fontStyle: "italic", marginTop: "4px" }}>
                      Project within studies
                    </div>
                    <ul style={{ ...bulletListStyle, marginTop: "12px" }}>
                      <li>
                        Designed an autonomous robot using Arduino, capable of
                        independently navigating to a charging station.
                      </li>
                      <li>
                        Implemented computer vision functionality with OpenCV to
                        detect and recognize QR codes for navigation.
                      </li>
                      <li>
                        Built a Python based GUI to monitor and control the
                        robot’s behavior.
                      </li>
                      <li>
                        Collaborated in an agile team, participating in sprint
                        reviews and maintaining project documentation.
                      </li>
                    </ul>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showVehicleModal && (
        <div style={modalOverlayStyle} onClick={() => setShowVehicleModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                padding: "14px 18px",
                borderBottom: `1px solid ${colors.subtleBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800 }}>
                  Autonomus Wireless Charging Vehicle
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: colors.muted,
                    marginTop: "2px",
                  }}
                >
                  Project image preview
                </div>
              </div>

              <button
                onClick={() => setShowVehicleModal(false)}
                style={{
                  border: `1px solid ${colors.subtleBorder}`,
                  background: "#ffffff",
                  color: colors.text,
                  borderRadius: "10px",
                  width: "36px",
                  height: "36px",
                  cursor: "pointer",
                  fontSize: "18px",
                  lineHeight: 1,
                }}
                aria-label="Close preview"
              >
                ×
              </button>
            </div>

            <div style={{ padding: "18px" }}>
              <img
                src="/resume/autonomous-vehicle/preview.png"
                alt="Autonomous vehicle enlarged preview"
                style={modalImageStyle}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(ResumeView);