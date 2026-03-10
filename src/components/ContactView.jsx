import { memo, useMemo, useState } from "react";

function ContactView() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [rotation, setRotation] = useState({ x: -6, y: 8 });

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const percentX = x / rect.width;
    const percentY = y / rect.height;

    const rotateY = (percentX - 0.5) * 12;
    const rotateX = (0.5 - percentY) * 10;

    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotation({ x: -6, y: 8 });
  };

  const cardTransform = useMemo(() => {
    return `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`;
  }, [rotation]);

  const cardPaper = "#f4efe6";
  const cardInk = "#23201c";
  const cardBorder = "#d8d0c3";

  const faceBaseStyle = {
    position: "absolute",
    inset: 0,
    borderRadius: "10px",
    backfaceVisibility: "hidden",
    overflow: "hidden",
    border: `1px solid ${cardBorder}`,
    boxShadow: "0 24px 60px rgba(15,23,42,0.16)",
    background: cardPaper,
    color: cardInk,
  };

  const serifTitle = {
    fontFamily:
      '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif',
    color: cardInk,
  };

  const textStyle = {
    fontFamily:
      '"Times New Roman", Georgia, Cambria, "Liberation Serif", serif',
    letterSpacing: "0.02em",
    color: cardInk,
  };

  return (
    <div
      style={{
        minHeight: "700px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0",
      }}
    >
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsFlipped((prev) => !prev)}
        style={{
          width: "min(100%, 700px)",
          perspective: "1600px",
          display: "flex",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "1.8 / 1",
            transformStyle: "preserve-3d",
            transform: `${cardTransform} rotateY(${isFlipped ? 180 : 0}deg)`,
            transition: "transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            position: "relative",
          }}
        >
          <div
            style={{
              ...faceBaseStyle,
              padding: "28px 34px 26px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                ...textStyle,
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <div>+49 176 72982405</div>

              <div
                style={{
                  textAlign: "right",
                  lineHeight: 1.15,
                }}
              >
                <div
                  style={{
                    ...serifTitle,
                    fontSize: "18px",
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                  }}
                >
                  BASEL HASAN
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Business Informatics
                </div>
              </div>
            </div>

            <div
              style={{
                textAlign: "center",
                paddingTop: "12px",
              }}
            >
              <div
                style={{
                  ...serifTitle,
                  fontSize: "30px",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  marginBottom: "4px",
                }}
              >
                Basel Hasan
              </div>
              <div
                style={{
                  ...serifTitle,
                  fontSize: "24px",
                  fontWeight: 600,
                }}
              >
                Student at TH Wildau
              </div>
            </div>

            <div
              style={{
                ...textStyle,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: "16px",
                fontSize: "12.5px",
                fontWeight: 600,
                lineHeight: 1.25,
              }}
            >
              <div>15745 Wildau, Germany</div>
              <div style={{ textAlign: "right" }}>baselkadhem@icloud.com</div>
            </div>
          </div>

          <div
            style={{
              ...faceBaseStyle,
              transform: "rotateY(180deg)",
              padding: "28px 34px 26px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                ...textStyle,
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <div>Currently seeking an internship</div>
              <div
                style={{
                  textAlign: "right",
                  lineHeight: 1.15,
                }}
              >
                <div
                  style={{
                    ...serifTitle,
                    fontSize: "18px",
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                  }}
                >
                  BASEL HASAN
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Contact
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "18px 26px",
                alignItems: "start",
                ...textStyle,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                    opacity: 0.75,
                  }}
                >
                  Email
                </div>
                <a
                  href="mailto:baselkadhem@icloud.com"
                  style={{
                    color: cardInk,
                    textDecoration: "none",
                    fontSize: "17px",
                    fontWeight: 600,
                  }}
                >
                  baselkadhem@icloud.com
                </a>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                    opacity: 0.75,
                  }}
                >
                  Website
                </div>
                <div
                  style={{
                    fontSize: "17px",
                    fontWeight: 600,
                  }}
                >
                  baselhasan.com
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                    opacity: 0.75,
                  }}
                >
                  Phone
                </div>
                <a
                  href="tel:+4917672982405"
                  style={{
                    color: cardInk,
                    textDecoration: "none",
                    fontSize: "17px",
                    fontWeight: 600,
                  }}
                >
                  +49 176 72982405
                </a>
              </div>

              <div>
                <div
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                    opacity: 0.75,
                  }}
                >
                  Focus
                </div>
                <div
                  style={{
                    fontSize: "17px",
                    fontWeight: 600,
                  }}
                >
                  AI, Data, Analytics
                </div>
              </div>
            </div>

            <div
              style={{
                ...textStyle,
                fontSize: "12.5px",
                fontWeight: 600,
                lineHeight: 1.35,
              }}
            >
              Open to internship and working student opportunities in data,
              analytics, automation, and product-focused environments.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ContactView);