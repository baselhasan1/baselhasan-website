import { createBvgFeed, UBAHN_LINE_REFS } from "../src/data/bvgFeed.js";
import { createVbbFeed } from "../src/data/vbbFeed.js";
import { UBAHN_STOPS } from "../src/data/ubahnStops.js";

const VALID_LINES = new Set(UBAHN_LINE_REFS);
const REQUEST_TIMEOUT_MS = 9000;
// The standby feed is one large document, so it gets its own, longer budget.
const FALLBACK_TIMEOUT_MS = 20000;

// One set of feeds per warm instance so their caches survive between calls.
// Vite's dev server re-evaluates this module on edit, so a fresh set per module
// instance is what we want there.
const warm = process.env.NODE_ENV === "production" ? globalThis.__ubahnFeeds : null;
const feeds = warm || {
  bvg: createBvgFeed({ userAgent: "baselhasan-map/2.0" }),
  vbb: createVbbFeed({ stops: UBAHN_STOPS, userAgent: "baselhasan-map/2.0" }),
};
globalThis.__ubahnFeeds = feeds;

function timeoutSignal(ms) {
  return typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(ms) : undefined;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const requested = String(req.query?.lines || "")
    .split(",")
    .map((line) => line.trim().toUpperCase())
    .filter((line) => VALID_LINES.has(line));
  const refs = [...new Set(requested)].slice(0, VALID_LINES.size);
  if (!refs.length) return res.status(400).json({ error: "No valid U-Bahn lines requested." });

  // BVG first: it reports each train's own position, which beats a timetable.
  // It is a community-run mirror of BVG's backend and it does go down, so a
  // failure — or a reply carrying no trains at all — falls through to VBB's
  // official feed rather than showing the map as dead.
  let payload = null;
  try {
    payload = await feeds.bvg.getPayload(refs, { signal: timeoutSignal(REQUEST_TIMEOUT_MS) });
    if (!Object.values(payload.lines).some((trips) => trips.length)) payload = null;
  } catch {
    payload = null;
  }

  if (!payload) {
    try {
      payload = await feeds.vbb.getPayload(refs, { signal: timeoutSignal(FALLBACK_TIMEOUT_MS) });
    } catch {
      return res.status(502).json({ lines: {}, errors: { all: "Live data unavailable" } });
    }
  }

  res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=20");
  return res.status(200).json(payload);
}
