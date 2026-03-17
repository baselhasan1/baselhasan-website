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

function StatCard({ label, value, sublabel, colors }) {
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
        {value}
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

function AnalyticsView({ colors }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/analytics");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load analytics.");
        }

        if (!cancelled) {
          setAnalytics(data);
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
  }, []);

  const visitCount = useMemo(
    () => formatNumber(analytics?.visits),
    [analytics]
  );

  const uniqueVisitors = useMemo(
    () => formatNumber(analytics?.uniqueVisitors),
    [analytics]
  );

  const timeSpent = useMemo(
    () => formatDuration(analytics?.timeSpentSeconds),
    [analytics]
  );

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
              textAlign: "center",
              fontSize: "18px",
              color: colors.muted,
              fontWeight: 600,
            }}
          >
            Loading analytics...
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
            <StatCard
              label="Visits"
              value={visitCount}
              sublabel="Total sessions for the last 30 days"
              colors={colors}
            />
            <StatCard
              label="Unique visitors"
              value={uniqueVisitors}
              sublabel="Distinct visitors for the last 30 days"
              colors={colors}
            />
            <StatCard
              label="Time spent"
              value={timeSpent}
              sublabel="Total engagement time for the last 30 days"
              colors={colors}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(AnalyticsView);