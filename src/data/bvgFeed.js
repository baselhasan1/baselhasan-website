/**
 * Shared BVG U-Bahn feed logic.
 *
 * Used by the serverless proxy (api/ubahn.js) and, as a fallback, directly by
 * the browser when the proxy is unreachable. It is deliberately plain ESM with
 * no Vite or Node specifics so both runtimes can import it unchanged.
 *
 * Data model
 * ----------
 * BVG's `/trips?lineName=U2&onlyCurrentlyRunning=true` lists every running
 * trip with a snapshot position but only its origin and destination. The full
 * timetable (every stop with realtime arrival/departure) comes from
 * `/trips/{id}?stopovers=true`, one request per trip. Trips last 20-40 min,
 * so each timetable is fetched once, cached for the lifetime of the trip, and
 * only refreshed when its delay changes or it gets old. A token bucket keeps
 * the detail traffic well inside the public API's rate limit; trips whose
 * detail is still pending are sent without `stops` and the client interpolates
 * them origin to destination until the timetable arrives.
 */

export const BVG_BASE_URL = "https://v6.bvg.transport.rest";
export const UBAHN_LINE_REFS = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9"];

export const LIST_TTL_MS = 15000;
export const DETAIL_REFRESH_MS = 6 * 60 * 1000;
export const DETAIL_FORGET_MS = 10 * 60 * 1000;
/**
 * A trip whose final arrival is this far in the past is over. HAFAS keeps
 * listing it as "running" for a while; the map has already let it fade.
 */
export const ENDED_GRACE_S = 20;

function toSeconds(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.round(ms / 1000) : null;
}

function round5(value) {
  return Math.round(value * 1e5) / 1e5;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** [lat, lng] for a HAFAS location, or null when it has no coordinates. */
function locationPair(location) {
  const lat = finiteOrNull(location?.latitude);
  const lng = finiteOrNull(location?.longitude);
  return lat == null || lng == null ? null : [round5(lat), round5(lng)];
}

/** "S+U Alexanderplatz Bhf (Berlin)" becomes "Alexanderplatz Bhf". */
export function cleanStopName(name) {
  return String(name || "")
    .replace(/\s*\(Berlin\)\s*/g, "")
    .replace(/^(S\+U|U|S)\s+/, "")
    .trim();
}

export function normalizeSummary(raw) {
  if (!raw || !raw.id) return null;
  const lat = finiteOrNull(raw.currentLocation?.latitude);
  const lng = finiteOrNull(raw.currentLocation?.longitude);

  return {
    id: String(raw.id),
    line: raw.line?.name || null,
    direction: String(raw.direction || raw.destination?.name || "").slice(0, 120),
    origin: String(raw.origin?.name || "").slice(0, 120),
    destination: String(raw.destination?.name || "").slice(0, 120),
    lat: lat == null ? null : round5(lat),
    lng: lng == null ? null : round5(lng),
    originAt: locationPair(raw.origin?.location),
    destinationAt: locationPair(raw.destination?.location),
    departure: toSeconds(raw.departure || raw.plannedDeparture),
    arrival: toSeconds(raw.arrival || raw.plannedArrival),
    arrivalDelay: finiteOrNull(raw.arrivalDelay),
    cancelled: Boolean(raw.cancelled),
  };
}

/** Every served stop of a trip with realtime times, in travel order. */
export function normalizeStopovers(raw) {
  return (raw?.stopovers || [])
    .map((stopover) => {
      if (stopover.cancelled) return null;
      const lat = finiteOrNull(stopover.stop?.location?.latitude);
      const lng = finiteOrNull(stopover.stop?.location?.longitude);
      if (lat == null || lng == null) return null;

      const arrival = toSeconds(stopover.arrival || stopover.plannedArrival);
      const departure = toSeconds(stopover.departure || stopover.plannedDeparture);
      if (arrival == null && departure == null) return null;

      return {
        id: String(stopover.stop?.id || ""),
        name: cleanStopName(stopover.stop?.name),
        lat: round5(lat),
        lng: round5(lng),
        arr: arrival ?? departure,
        dep: departure ?? arrival,
      };
    })
    .filter(Boolean);
}

export function isFinished(summary, nowSeconds) {
  return summary.arrival != null && summary.arrival + ENDED_GRACE_S < nowSeconds;
}

/** The caller's signal, if any, combined with a per-request timeout. */
function withTimeout(signal, ms) {
  const hasTimeout = typeof AbortSignal?.timeout === "function";
  if (!hasTimeout) return signal;
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  return typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : signal;
}

/**
 * Creates an aggregator with its own caches. One instance per process on the
 * server; one per page in the browser fallback.
 */
export function createBvgFeed({
  fetch: fetchImpl = null,
  now = () => Date.now(),
  detailBudgetPerMinute = 45,
  detailConcurrency = 4,
  detailTimeCapMs = 3000,
  requestTimeoutMs = 8000,
  userAgent = null,
} = {}) {
  const lists = new Map();
  const details = new Map();
  let tokens = detailBudgetPerMinute;
  let lastRefill = now();

  function refillTokens() {
    const current = now();
    const earned = ((current - lastRefill) / 60000) * detailBudgetPerMinute;
    tokens = Math.min(detailBudgetPerMinute, tokens + earned);
    lastRefill = current;
  }

  async function getJson(path, params, signal) {
    const url = new URL(path, BVG_BASE_URL);
    if (params) url.search = new URLSearchParams(params).toString();

    const headers = { Accept: "application/json" };
    if (userAgent) headers["User-Agent"] = userAgent;

    // Resolved per call so a test (or polyfill) can swap globalThis.fetch later.
    const doFetch = fetchImpl || globalThis.fetch;
    const response = await doFetch(url.toString(), {
      headers,
      signal: withTimeout(signal, requestTimeoutMs),
    });
    if (response.ok) return response.json();

    // HAFAS answers a line with no running trips with 404 NO_MATCH; that is an
    // empty result, not an outage.
    if (response.status === 404) {
      const body = await response.json().catch(() => null);
      if (body?.hafasCode === "NO_MATCH" || body?.code === "NOT_FOUND") return { trips: [] };
    }
    throw new Error(`BVG responded ${response.status} for ${path}`);
  }

  async function loadLine(ref, signal) {
    const cached = lists.get(ref);
    const current = now();
    if (cached && current - cached.at < LIST_TTL_MS) return cached;

    const data = await getJson(
      "/trips",
      {
        lineName: ref,
        onlyCurrentlyRunning: "true",
        stopovers: "false",
        remarks: "false",
        polylines: "false",
      },
      signal
    );

    const nowSeconds = Math.floor(current / 1000);
    const seen = new Set();
    const trips = [];
    (data.trips || []).forEach((raw) => {
      const summary = normalizeSummary(raw);
      if (!summary || summary.cancelled || summary.lat == null) return;
      if (isFinished(summary, nowSeconds) || seen.has(summary.id)) return;
      seen.add(summary.id);
      trips.push(summary);
    });

    const entry = {
      at: current,
      trips,
      realtimeAt: Number.isFinite(data.realtimeDataUpdatedAt)
        ? data.realtimeDataUpdatedAt * 1000
        : null,
    };
    lists.set(ref, entry);
    return entry;
  }

  function detailIsStale(summary, detail, current) {
    if (!detail) return true;
    if (current - detail.at > DETAIL_REFRESH_MS) return true;
    if (
      summary.arrivalDelay != null &&
      detail.arrivalDelay != null &&
      Math.abs(summary.arrivalDelay - detail.arrivalDelay) >= 60
    ) {
      return true;
    }
    return false;
  }

  async function loadDetail(id, signal) {
    const data = await getJson(
      `/trips/${encodeURIComponent(id)}`,
      { stopovers: "true", remarks: "false", polylines: "false" },
      signal
    );
    const trip = data.trip || data;
    const entry = {
      at: now(),
      seenAt: now(),
      stops: normalizeStopovers(trip),
      arrivalDelay: finiteOrNull(trip.arrivalDelay),
    };
    details.set(id, entry);
    return entry;
  }

  /** Fetches missing/stale timetables within the rate budget and time cap. */
  async function fillDetails(summaries, signal) {
    refillTokens();
    const current = now();
    const unique = new Map();
    summaries.forEach((summary) => {
      if (!unique.has(summary.id)) unique.set(summary.id, summary);
    });
    const wanted = [...unique.values()].filter((summary) =>
      detailIsStale(summary, details.get(summary.id), current)
    );
    // Trips with no timetable at all come before refreshes of stale ones.
    wanted.sort((a, b) => (details.has(a.id) ? 1 : 0) - (details.has(b.id) ? 1 : 0));

    const deadline = current + detailTimeCapMs;
    let index = 0;
    const worker = async () => {
      while (index < wanted.length && tokens >= 1 && now() < deadline) {
        const summary = wanted[index];
        index += 1;
        tokens -= 1;
        try {
          await loadDetail(summary.id, signal);
        } catch (error) {
          if (error.name === "AbortError") throw error;
          // Leave it for the next poll; the client interpolates meanwhile.
        }
      }
    };
    await Promise.all(Array.from({ length: detailConcurrency }, worker));
  }

  function forgetOldDetails() {
    const current = now();
    details.forEach((detail, id) => {
      if (current - detail.seenAt > DETAIL_FORGET_MS) details.delete(id);
    });
  }

  function toPayload(summary) {
    const detail = details.get(summary.id);
    if (detail) detail.seenAt = now();
    return {
      id: summary.id,
      dir: cleanStopName(summary.direction),
      from: cleanStopName(summary.origin),
      to: cleanStopName(summary.destination),
      lat: summary.lat,
      lng: summary.lng,
      o: summary.originAt,
      d: summary.destinationAt,
      dep: summary.departure,
      arr: summary.arrival,
      delay: summary.arrivalDelay,
      stops: detail
        ? detail.stops.map((stop) => [stop.lat, stop.lng, stop.arr, stop.dep, stop.name, stop.id])
        : null,
    };
  }

  /**
   * Aggregated snapshot for the requested lines:
   * { lines: { U2: [trip, ...] }, errors: { U4: "..." }, count, now, realtimeAt }
   */
  async function getPayload(refs, { signal } = {}) {
    const settled = await Promise.allSettled(refs.map((ref) => loadLine(ref, signal)));
    const lines = {};
    const errors = {};
    const all = [];
    let realtimeAt = null;

    settled.forEach((result, index) => {
      const ref = refs[index];
      if (result.status === "fulfilled") {
        lines[ref] = result.value.trips;
        all.push(...result.value.trips);
        if (result.value.realtimeAt) {
          realtimeAt = Math.max(realtimeAt || 0, result.value.realtimeAt);
        }
      } else {
        errors[ref] = "Live data unavailable";
      }
    });

    try {
      await fillDetails(all, signal);
    } catch (error) {
      if (error.name === "AbortError") throw error;
    }

    const payloadLines = {};
    Object.keys(lines).forEach((ref) => {
      payloadLines[ref] = lines[ref].map(toPayload);
    });
    forgetOldDetails();

    const uniqueIds = new Set(all.map((summary) => summary.id));
    return { lines: payloadLines, errors, count: uniqueIds.size, now: now(), realtimeAt };
  }

  return { getPayload, loadLine, loadDetail, caches: { lists, details } };
}
