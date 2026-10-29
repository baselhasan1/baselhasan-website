import { useEffect, useRef, useState } from "react";

const FULL_TEXT = "BASEL HASAN";
const TYPE_MS = 75;
const HOLD_MS = 450;
// Matches the bh-intro-out animation in index.css.
const EXIT_MS = 400;

/**
 * Types the name, then fades away to reveal the site, which has been loading
 * underneath the whole time. Any click or key skips straight to the fade.
 */
function IntroScreen({ onFinish }) {
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const leaveRef = useRef(null);

  useEffect(() => {
    let charIndex = 0;
    let typingTimeout;
    let holdTimeout;
    let exitTimeout;

    const leave = () => {
      if (exitTimeout) return;
      clearTimeout(typingTimeout);
      clearTimeout(holdTimeout);
      setIsLeaving(true);
      exitTimeout = setTimeout(onFinish, EXIT_MS);
    };
    leaveRef.current = leave;

    const typeNextChar = () => {
      if (charIndex < FULL_TEXT.length) {
        setDisplayedText(FULL_TEXT.slice(0, charIndex + 1));
        charIndex += 1;
        typingTimeout = setTimeout(typeNextChar, TYPE_MS);
      } else {
        holdTimeout = setTimeout(leave, HOLD_MS);
      }
    };

    typeNextChar();

    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);

    window.addEventListener("keydown", leave);

    return () => {
      clearTimeout(typingTimeout);
      clearTimeout(holdTimeout);
      clearTimeout(exitTimeout);
      clearInterval(cursorInterval);
      window.removeEventListener("keydown", leave);
    };
  }, [onFinish]);

  return (
    <div
      className="bh-intro"
      data-state={isLeaving ? "leaving" : "typing"}
      onClick={() => leaveRef.current?.()}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        cursor: "pointer",
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
