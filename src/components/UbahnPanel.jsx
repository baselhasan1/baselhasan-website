import { useEffect, useState } from "react";
import UBAHN_LINES, { readableInk } from "../data/ubahnLines.js";
import "../ubahn.css";

/**
 * Compact live-status widget for the Berlin U-Bahn layer: the running-train
 * count, one toggle pill per line (in its official colour) and a freshness
 * line. Styled with the same glass surface as the rest of the map chrome.
 */
function UbahnPanel({ stats, visibleLines, onToggleLine, onSetAll }) {
  const allOn = visibleLines.size === UBAHN_LINES.length;
  const [now, setNow] = useState(() => Date.now());

  // Keep "updated Ns ago" moving between polls.
  useEffect(() => {
    if (stats.status !== "live") return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [stats.status, stats.updatedAt]);

  const ageSeconds =
    stats.updatedAt != null ? Math.max(0, Math.round((now - stats.updatedAt) / 1000)) : null;

  // Name the feed that is actually answering: BVG's own positions when its
  // upstream is up, VBB's official timetable feed when it is not.
  const feed = stats.feed || "BVG";
  let footer = `Live from ${feed}`;
  if (stats.status === "live" && ageSeconds != null) {
    footer += ageSeconds < 3 ? " · just now" : ` · updated ${ageSeconds}s ago`;
  } else if (stats.status === "error") {
    footer = "Live feed unavailable · retrying";
  }

  return (
    <div className="bh-glass bh-glass--panel ubahn-panel" role="region" aria-label="Live U-Bahn">
      <div className="ubahn-panel__status">
        <span
          className={`ubahn-panel__dot${
            stats.status === "live" ? " bh-live-dot" : stats.status === "error" ? " is-error" : " is-loading"
          }`}
        />
        {stats.status === "live" ? (
          <span className="ubahn-panel__count">
            {stats.trains}
            <small>{stats.trains === 1 ? "train" : "trains"} live</small>
          </span>
        ) : (
          <span className="ubahn-panel__count">
            <small style={{ marginLeft: 0 }}>
              {stats.status === "error" ? "Live data unavailable" : "Connecting…"}
            </small>
          </span>
        )}
      </div>

      <div className="ubahn-panel__lines">
        {UBAHN_LINES.map(({ ref, color }) => {
          const isOn = visibleLines.has(ref);
          const count = stats.byLine?.[ref];
          const title = isOn
            ? `${ref}${count != null ? ` · ${count} ${count === 1 ? "train" : "trains"}` : ""} · click to hide`
            : `${ref} · click to show`;

          return (
            <button
              key={ref}
              type="button"
              onClick={() => onToggleLine(ref)}
              aria-pressed={isOn}
              title={title}
              className={`ubahn-panel__line${isOn ? "" : " is-off"}${isOn && count === 0 ? " is-quiet" : ""}`}
              style={{ background: color, color: readableInk(color) }}
            >
              {ref}
            </button>
          );
        })}
      </div>

      <div className="ubahn-panel__foot">
        <span>{footer}</span>
        <button type="button" onClick={() => onSetAll(!allOn)}>
          {allOn ? "Hide all" : "Show all"}
        </button>
      </div>
    </div>
  );
}

export default UbahnPanel;
