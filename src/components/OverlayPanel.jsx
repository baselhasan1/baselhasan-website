import { useEffect, useRef } from "react";
import { prefersReducedMotion, revealBlocks } from "../utils/motion.js";

/**
 * A section panel that floats over the live map. It deliberately starts below
 * the header so the navigation stays visible and clickable behind it — you can
 * jump straight from Resume to Contact without closing anything first.
 *
 * `isClosing` plays the exit animation; App keeps the panel mounted until it
 * finishes (see usePresence).
 */
function OverlayPanel({ title, colors, onClose, isClosing = false, children }) {
  const closeRef = useRef(null);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Cascade each view in as it mounts — on open, and again when switching
  // straight from one section to another.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;

    let animations = [];
    const reveal = () => {
      animations.forEach((animation) => animation.cancel());
      animations = revealBlocks(content.firstElementChild);
    };

    reveal();
    const observer = new MutationObserver(reveal);
    observer.observe(content, { childList: true });

    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
  }, []);

  // Smooth, weighted wheel scrolling inside the panel. Loaded on demand so it
  // costs nothing until a panel is opened.
  useEffect(() => {
    const wrapper = scrollRef.current;
    if (!wrapper || prefersReducedMotion()) return undefined;

    let lenis = null;
    let cancelled = false;

    import("lenis")
      .then(({ default: Lenis }) => {
        if (cancelled) return;
        lenis = new Lenis({
          wrapper,
          content: contentRef.current,
          lerp: 0.1,
          smoothWheel: true,
          autoRaf: true,
        });
      })
      .catch(() => {
        // Native scrolling still works; smoothing is an enhancement.
      });

    return () => {
      cancelled = true;
      lenis?.destroy();
    };
  }, []);

  return (
    <div
      className="bh-overlay"
      data-state={isClosing ? "closing" : "open"}
      onClick={onClose}
    >
      <div
        className="bh-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bh-panel-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "18px 24px",
            borderBottom: `1px solid ${colors.subtleBorder}`,
            background: colors.shellBg,
            flexShrink: 0,
          }}
        >
          <div
            id="bh-panel-title"
            style={{
              fontSize: "12px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: colors.muted,
              fontWeight: 600,
            }}
          >
            {title}
          </div>

          <button
            ref={closeRef}
            onClick={onClose}
            style={{
              border: `1px solid ${colors.subtleBorder}`,
              background: colors.buttonBg,
              color: colors.text,
              borderRadius: "12px",
              width: "34px",
              height: "34px",
              fontSize: "17px",
              lineHeight: 1,
              cursor: "pointer",
              flexShrink: 0,
            }}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </div>

        <div ref={scrollRef} className="bh-panel-scroll">
          <div ref={contentRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default OverlayPanel;
