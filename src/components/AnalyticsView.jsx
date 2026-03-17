import { memo, useEffect, useMemo, useState } from "react";

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function useAnimatedValue(target, duration = 900) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frameId;
    let startTime = null;
    const startValue = displayValue;
    const endValue = Number(target || 0);

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      const nextValue = Math.round(
        startValue + (endValue - startValue) * easedProgress
      );

      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [target]);

  return displayValue;
}

function StatCard({ label, value, sublabel, colors, isDuration = false }) {
  const animatedValue = useAnimatedValue(value);

  return (
    <div
      style={{
        border: `1px solid ${colors.subtleBorder}`,
        borderRadius: "28px",
        background: "#ffffff",
        padding: "28px 30px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minHeight: "160px",
        justifyContent: "center",
        boxShadow: "0 10px 24px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: colors.muted,
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "64px",
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: colors.text,
        }}
      >
        {isDuration
          ? formatDuration(animatedValue)
          : formatNumber(animatedValue)}
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#57534e",
        }}
      >
        {sublabel}
      </div>
    </div>
  );
}

function getLastUpdatedLabel(timestamp) {
  if (!timestamp) return "";

  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 10) return "Last updated just now";
  if (diffSeconds < 60) return `Last updated ${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Last updated ${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  return `Last updated ${diffHours}h ago`;
}

function getRangeLabel(range) {
  if (range === "7d") return "last 7 days";
  if (range === "all") return "all time";
  return "last 30 days";
}

function AnalyticsView({ colors }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedRange, setSelectedRange] = useState("30d");

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/analytics?range=${selectedRange}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load analytics.");
        }

        if (!cancelled) {
          setAnalytics(data);
          setLastUpdated(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load analytics.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [selectedRange]);

  const lastUpdatedLabel = useMemo(
    () => getLastUpdatedLabel(lastUpdated),
    [lastUpdated]
  );

  const rangeButtonStyle = (range) => {
    const isActive = selectedRange === range;

    return {
      padding: "10px 14px",
      borderRadius: "12px",
      border: `1.5px solid ${isActive ? colors.border : colors.subtleBorder}`,
      background: isActive ? colors.buttonActiveBg : "#ffffff",
      color: colors.text,
      fontSize: "13px",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: isActive
        ? "inset 0 1px 2px rgba(0,0,0,0.08)"
        : "0 2px 6px rgba(0,0,0,0.04)",
      transition: "all 0.16s ease",
    };
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
        Analytics
      </div>

      <div
        style={{
          borderRadius: "30px",
          border: `1px solid ${colors.subtleBorder}`,
          minHeight: "520px",
          background: "#fcfcfb",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <div
            style={{
              maxWidth: "720px",
              margin: "0 auto",
              textAlign: "center",
              border: `1px solid ${colors.subtleBorder}`,
              borderRadius: "24px",
              background: "#ffffff",
              padding: "28px",
              boxShadow: "0 10px 24px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
                marginBottom: "10px",
                letterSpacing: "-0.02em",
              }}
            >
              Loading analytics
            </div>
            <div
              style={{
                fontSize: "16px",
                lineHeight: 1.6,
                color: "#57534e",
              }}
            >
              Fetching the latest website activity.
            </div>
          </div>
        ) : error ? (
          <div
            style={{
              maxWidth: "720px",
              margin: "0 auto",
              textAlign: "center",
              border: `1px solid ${colors.subtleBorder}`,
              borderRadius: "24px",
              background: "#ffffff",
              padding: "28px",
              boxShadow: "0 10px 24px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
                marginBottom: "10px",
                letterSpacing: "-0.02em",
              }}
            >
              Analytics unavailable
            </div>
            <div
              style={{
                fontSize: "16px",
                lineHeight: 1.6,
                color: "#57534e",
              }}
            >
              {error}
            </div>
          </div>
        ) : (
          <div
            style={{
              maxWidth: "980px",
              width: "100%",
              margin: "0 auto",
              display: "grid",
              gap: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: colors.muted,
                }}
              >
                {lastUpdatedLabel}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => setSelectedRange("7d")}
                  style={rangeButtonStyle("7d")}
                >
                  7D
                </button>
                <button
                  onClick={() => setSelectedRange("30d")}
                  style={rangeButtonStyle("30d")}
                >
                  30D
                </button>
                <button
                  onClick={() => setSelectedRange("all")}
                  style={rangeButtonStyle("all")}
                >
                  All time
                </button>
              </div>
            </div>

            <StatCard
              label="Visits"
              value={analytics?.visits}
              sublabel={`Total sessions for the ${getRangeLabel(selectedRange)}`}
              colors={colors}
            />

            <StatCard
              label="Unique visitors"
              value={analytics?.uniqueVisitors}
              sublabel={`Distinct visitors for the ${getRangeLabel(selectedRange)}`}
              colors={colors}
            />

            <StatCard
              label="Time spent"
              value={analytics?.timeSpentSeconds}
              sublabel={`Total engagement time for the ${getRangeLabel(selectedRange)}`}
              colors={colors}
              isDuration
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(AnalyticsView);