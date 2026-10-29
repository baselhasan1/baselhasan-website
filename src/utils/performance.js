const PREFIX = "bh-map:";

export function startMeasure(name) {
  performance.mark(`${PREFIX}${name}:start`);
}

export function endMeasure(name) {
  const start = `${PREFIX}${name}:start`;
  const end = `${PREFIX}${name}:end`;
  performance.mark(end);
  try {
    performance.measure(`${PREFIX}${name}`, start, end);
  } catch {
    // A missing mark should never affect the map experience.
  }
}

export function initializePerformanceMonitoring() {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration >= 100) {
          window.dispatchEvent(new CustomEvent("bh:long-task", { detail: entry.duration }));
        }
      });
    });
    observer.observe({ type: "longtask", buffered: true });
  } catch {
    // Long-task observation is optional and unsupported in some browsers.
  }
}
