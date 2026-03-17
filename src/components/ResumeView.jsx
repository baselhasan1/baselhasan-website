import { memo } from "react";

function ResumeView({ colors, onNavigateToSection }) {
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

  const contactLinkStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: `1.5px solid ${colors.subtleBorder}`,
    background: "#ffffff",
    color: colors.text,
    borderRadius: "12px",
    padding: "9px 12px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
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
                <button
                  onClick={() => onNavigateToSection?.("contact")}
                  style={contactLinkStyle}
                >
                  Go to contact page <span>›</span>
                </button>
                <div style={{ ...bodyStyle, marginTop: "14px" }}>
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
                  freelance producer, demonstrating creativity, self-management,
                  and project ownership alongside academic studies.
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
                      Designed and developed a RESTful backend architecture for a
                      gift exchange system.
                    </li>
                    <li>
                      Implemented user authentication, logic and randomized
                      algorithms via REST APIs.
                    </li>
                    <li>
                      Integrated relational database persistence with structured
                      error handling and HTTP status codes.
                    </li>
                  </ul>
                </div>

                <div style={bodyStyle}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: "17px",
                    }}
                  >
                    Autonomus Wireless Charging Vehicle
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
  );
}

export default memo(ResumeView);