import { useEffect, useState } from "react";

function IntroScreen({ onFinish }) {
  const fullText = "BASEL HASAN";
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let charIndex = 0;
    let typingTimeout;
    let finishTimeout;
    let cursorInterval;

    const typeNextChar = () => {
      if (charIndex < fullText.length) {
        setDisplayedText(fullText.slice(0, charIndex + 1));
        charIndex += 1;
        typingTimeout = setTimeout(typeNextChar, 140);
      } else {
        finishTimeout = setTimeout(() => {
          onFinish();
        }, 1000);
      }
    };

    typeNextChar();

    cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);

    return () => {
      clearTimeout(typingTimeout);
      clearTimeout(finishTimeout);
      clearInterval(cursorInterval);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
      }}
    >
      <div
        style={{
          fontSize: "clamp(34px, 6vw, 72px)",
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "#111827",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          whiteSpace: "pre",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span>{displayedText}</span>
        <span
          style={{
            display: "inline-block",
            width: "3px",
            height: "1em",
            marginLeft: "8px",
            backgroundColor: "#111827",
            opacity: showCursor ? 1 : 0,
            transition: "opacity 0.1s linear",
          }}
        />
      </div>
    </div>
  );
}

export default IntroScreen;