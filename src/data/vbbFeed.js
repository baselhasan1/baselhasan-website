/**
 * Live U-Bahn trips from VBB's official GTFS-realtime feed.
 *
 * This is the standby source. The primary one, `bvgFeed.js`, reports each
 * train's own GPS position, which is better data — but it is a community-run
 * mirror of BVG's backend and it goes down. When it does, this takes over.
 *
 * The trade is that GTFS-realtime carries no vehicle positions, only stop
 * times. That is enough: the map already places trains by interpolating along
 * the track between timed stops, so a trip's stop list is all it needs. Trains
 * run to the timetable rather than to a reported position, which is accurate to
 * within a stop's worth of travel.
 *
 * No key, no registration, 60 requests a minute. The feed is one ~10 MB
 * protobuf for the whole region, so it is fetched and filtered server side and
 * cached; it is far too big to hand to a browser.
 */

export const VBB_FEED_URL = "https://production.gtfsrt.vbb.de/data";

// VBB suffixes every route id with its GTFS route type. 400 is "urban
// railway", which in Berlin is the U-Bahn; S-Bahn is 109, tram 900, bus 700.
const UBAHN_ROUTE_SUFFIX = "_400";
// Berlin's authority prefix inside a DHID.
const BERLIN_DHID = "de:11000:";
export const VBB_CACHE_TTL_MS = 20000;

/* ------------------------------------------------------------------ */
/* Protobuf                                                            */
/* ------------------------------------------------------------------ */

/**
 * Just enough wire-format reader for the handful of fields used below. A
 * dependency would be a lot of surface area for one message shape that has not
 * changed since GTFS-realtime 1.0.
 */
function* readFields(buf, start = 0, end = buf.length) {
  let i = start;
  while (i < end) {
    let key = 0;
    let shift = 0;
    while (true) {
      if (i >= end) return;
      const byte = buf[i++];
      key |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) break;
      shift += 7;
      if (shift > 28) return;
    }
    const field = key >>> 3;
    const wire = key & 7;

    if (wire === 2) {
      let len = 0;
      let s = 0;
      while (true) {
        if (i >= end) return;
        const byte = buf[i++];
        len |= (byte & 0x7f) << s;
        if (!(byte & 0x80)) break;
        s += 7;
        if (s > 28) return;
      }
      if (i + len > end) return;
      yield [field, buf.subarray(i, i + len), wire];
      i += len;
    } else if (wire === 0) {
      let value = 0;
      let s = 0;
      while (true) {
        if (i >= end) return;
        const byte = buf[i++];
        value += (byte & 0x7f) * 2 ** s;
        if (!(byte & 0x80)) break;
        s += 7;
      }
      yield [field, value, wire];
    } else if (wire === 5) {
      i += 4;
    } else if (wire === 1) {
      i += 8;
    } else {
      return;
    }
  }
}

const text = (bytes) => new TextDecoder().decode(bytes);

/** GTFS-realtime StopTimeEvent: delay=1, time=2, uncertainty=3. */
function readStopTimeEvent(buf) {
  let time = null;
  let delay = null;
  for (const [field, value, wire] of readFields(buf)) {
    if (field === 2 && wire === 0) time = value;
    else if (field === 1 && wire === 0) delay = value;
  }
  return { time, delay };
}

/** StopTimeUpdate: stop_sequence=1, arrival=2, departure=3, stop_id=4. */
function readStopTimeUpdate(buf) {
  let stopId = null;
  let arrival = null;
  let departure = null;
  for (const [field, value, wire] of readFields(buf)) {
    if (field === 4 && wire === 2) stopId = text(value);
    else if (field === 2 && wire === 2) arrival = readStopTimeEvent(value);
    else if (field === 3 && wire === 2) departure = readStopTimeEvent(value);
  }
  return { stopId, arrival, departure };
}

/** TripDescriptor: trip_id=1, route_id=5. */
function readTripDescriptor(buf) {
  let tripId = null;
  let routeId = null;
  for (const [field, value, wire] of readFields(buf)) {
    if (field === 1 && wire === 2) tripId = text(value);
    else if (field === 5 && wire === 2) routeId = text(value);
  }
  return { tripId, routeId };
}

/** TripUpdate: trip=1, stop_time_update=2, timestamp=4, delay=5. */
function readTripUpdate(buf) {
  let trip = null;
  const stops = [];
  let delay = null;
  for (const [field, value, wire] of readFields(buf)) {
    if (field === 1 && wire === 2) trip = readTripDescriptor(value);
    else if (field === 2 && wire === 2) stops.push(readStopTimeUpdate(value));
    else if (field === 5 && wire === 0) delay = value;
  }
  return { trip, stops, delay };
}

/** FeedMessage: header=1, entity=2. FeedEntity: id=1, trip_update=3. */
export function parseTripUpdates(bytes) {
  const updates = [];
  for (const [field, value, wire] of readFields(bytes)) {
    if (field !== 2 || wire !== 2) continue;
    for (const [entityField, entityValue, entityWire] of readFields(value)) {
      if (entityField === 3 && entityWire === 2) {
        updates.push(readTripUpdate(entityValue));
      }
    }
  }
  return updates;
}

/* ------------------------------------------------------------------ */
/* Trips                                                               */
/* ------------------------------------------------------------------ */

/** `de:11000:900023302::1` -> `900023302`, which is how the geometry ids stops. */
export function dhidToStopId(dhid) {
  if (typeof dhid !== "string" || !dhid.startsWith(BERLIN_DHID)) return null;
  const core = dhid.slice(BERLIN_DHID.length).split(":")[0];
  return /^\d+$/.test(core) ? core : null;
}

/**
 * Which U line a trip belongs to. The feed's route ids are opaque numbers, so
 * the line is read off the stops instead: the one that serves the most of them
 * wins, and ties are rejected rather than guessed.
 */
export function inferLine(stops) {
  const votes = new Map();
  for (const stop of stops) {
    for (const line of stop.lines) votes.set(line, (votes.get(line) || 0) + 1);
  }
  if (!votes.size) return null;
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
  // A line that serves only a couple of a trip's stops is a crossing, not its line.
  return ranked[0][1] >= Math.max(2, stops.length * 0.6) ? ranked[0][0] : null;
}

function buildTrip(update, stopsById) {
  const resolved = [];
  for (const stop of update.stops) {
    const id = dhidToStopId(stop.stopId);
    if (!id) continue;
    const known = stopsById[id];
    if (!known) continue;
    const [lat, lng, name, lines] = known;
    const arr = stop.arrival?.time ?? stop.departure?.time ?? null;
    const dep = stop.departure?.time ?? stop.arrival?.time ?? null;
    if (arr == null && dep == null) continue;
    resolved.push({ id, lat, lng, name, lines, arr: arr ?? dep, dep: dep ?? arr });
  }
  if (resolved.length < 2) return null;

  resolved.sort((a, b) => a.arr - b.arr);
  const line = inferLine(resolved);
  if (!line) return null;

  const first = resolved[0];
  const last = resolved[resolved.length - 1];
  return {
    line,
    trip: {
      id: String(update.trip?.tripId || `${line}-${first.arr}-${last.arr}`),
      dir: last.name,
      from: first.name,
      to: last.name,
      // No reported position: the map interpolates from the stop times.
      lat: null,
      lng: null,
      o: [first.lat, first.lng],
      d: [last.lat, last.lng],
      dep: first.dep,
      arr: last.arr,
      delay: update.delay ?? null,
      stops: resolved.map((s) => [s.lat, s.lng, s.arr, s.dep, s.name, s.id]),
    },
  };
}

/**
 * Groups the feed's U-Bahn trips by line, keeping only those running now.
 * Shape matches `bvgFeed`'s payload so either source can drive the map.
 */
export function buildPayload(updates, stopsById, nowSeconds) {
  const lines = {};
  let seen = 0;

  for (const update of updates) {
    if (!update.trip?.routeId?.endsWith(UBAHN_ROUTE_SUFFIX)) continue;
    const built = buildTrip(update, stopsById);
    if (!built) continue;
    const { line, trip } = built;
    // Running now, with a little slack so a train is not dropped between its
    // last arrival and the next poll.
    if (trip.dep > nowSeconds + 60 || trip.arr + 30 < nowSeconds) continue;
    (lines[line] ||= []).push(trip);
    seen += 1;
  }

  return { lines, count: seen };
}

/**
 * Creates a fetcher with its own cache. The feed is one big document for the
 * whole region, so it is fetched once per interval and sliced per request.
 */
export function createVbbFeed({
  fetch: fetchImpl = null,
  now = () => Date.now(),
  stops,
  userAgent = "baselhasan-map/2.0",
  url = VBB_FEED_URL,
} = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  let cache = null;
  let inFlight = null;

  async function load(signal) {
    const fresh = cache && now() - cache.at < VBB_CACHE_TTL_MS;
    if (fresh) return cache.updates;
    if (inFlight) return inFlight;

    inFlight = (async () => {
      const response = await doFetch(url, {
        headers: { Accept: "application/protobuf", "User-Agent": userAgent },
        signal,
      });
      if (!response.ok) throw new Error(`VBB feed returned ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const updates = parseTripUpdates(bytes);
      cache = { at: now(), updates };
      return updates;
    })();

    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  }

  async function getPayload(refs, { signal } = {}) {
    const updates = await load(signal);
    const nowMs = now();
    const { lines, count } = buildPayload(updates, stops, Math.floor(nowMs / 1000));

    const wanted = {};
    for (const ref of refs) wanted[ref] = lines[ref] || [];
    return {
      lines: wanted,
      errors: {},
      count,
      now: nowMs,
      realtimeAt: Math.floor(nowMs / 1000),
      source: "vbb",
    };
  }

  return { getPayload, load };
}
