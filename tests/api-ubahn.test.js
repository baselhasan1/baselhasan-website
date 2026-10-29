import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/ubahn.js";
import { createBvgFeed, normalizeStopovers, cleanStopName } from "../src/data/bvgFeed.js";

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const FUTURE = new Date(Date.now() + 20 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 10 * 60 * 1000).toISOString();

function listPayload(id, extra = {}) {
  return {
    realtimeDataUpdatedAt: Math.floor(Date.now() / 1000),
    trips: [{
      id,
      direction: "S+U Alexanderplatz Bhf (Berlin)",
      origin: { name: "S+U Pankow (Berlin)" },
      destination: { name: "U Ruhleben (Berlin)" },
      departure: PAST,
      arrival: FUTURE,
      arrivalDelay: 0,
      currentLocation: { latitude: 52.52, longitude: 13.405 },
      ...extra,
    }],
  };
}

function detailPayload(id) {
  return {
    trip: {
      id,
      arrivalDelay: 0,
      stopovers: [
        { stop: { id: "1", name: "S+U Pankow (Berlin)", location: { latitude: 52.567, longitude: 13.412 } }, arrival: null, departure: PAST },
        { stop: { id: "2", name: "U Vinetastr. (Berlin)", location: { latitude: 52.559, longitude: 13.413 } }, arrival: FUTURE, departure: FUTURE },
        { stop: { id: "3", name: "Cancelled stop", location: { latitude: 52.55, longitude: 13.41 } }, cancelled: true, arrival: FUTURE, departure: FUTURE },
      ],
    },
  };
}

test("aggregates lines, attaches timetables, and caches", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/trips/")) return jsonResponse(detailPayload("trip-1"));
    return jsonResponse(listPayload("trip-1"));
  };

  try {
    const first = responseRecorder();
    await handler({ method: "GET", query: { lines: "U1,U2,INVALID" } }, first);
    assert.equal(first.statusCode, 200);
    assert.deepEqual(Object.keys(first.body.lines), ["U1", "U2"]);
    assert.equal(first.body.count, 1, "the same trip id on two lines counts once");

    const trip = first.body.lines.U1[0];
    assert.equal(trip.dir, "Alexanderplatz Bhf");
    assert.equal(trip.to, "Ruhleben");
    assert.equal(trip.lat, 52.52);
    assert.equal(trip.stops.length, 2, "cancelled stopovers are dropped");
    assert.equal(trip.stops[1][4], "Vinetastr.");
    assert.equal(typeof trip.stops[1][2], "number", "times are epoch seconds");

    const listCalls = calls.filter((url) => !url.includes("/trips/")).length;
    const detailCalls = calls.filter((url) => url.includes("/trips/")).length;
    assert.equal(listCalls, 2);
    assert.equal(detailCalls, 1, "a trip timetable is fetched once");

    const second = responseRecorder();
    await handler({ method: "GET", query: { lines: "U1,U2" } }, second);
    assert.equal(calls.length, 3, "the second request is served from cache");
    assert.equal(second.body.lines.U1[0].stops.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("drops cancelled, finished, and unlocated trips from the count", async () => {
  let clock = Date.now();
  const feed = createBvgFeed({
    now: () => clock,
    fetch: async (url) => {
      if (String(url).includes("/trips/")) return jsonResponse(detailPayload("live"));
      return jsonResponse({
        trips: [
          listPayload("live").trips[0],
          listPayload("cancelled", { cancelled: true }).trips[0],
          listPayload("finished", { arrival: PAST }).trips[0],
          listPayload("nowhere", { currentLocation: null }).trips[0],
        ],
      });
    },
  });

  const payload = await feed.getPayload(["U5"]);
  assert.equal(payload.count, 1);
  assert.deepEqual(payload.lines.U5.map((trip) => trip.id), ["live"]);

  clock += 16000;
  const again = await feed.getPayload(["U5"]);
  assert.equal(again.count, 1);
});

test("respects the timetable budget and sends trips without stops meanwhile", async () => {
  const feed = createBvgFeed({
    detailBudgetPerMinute: 1,
    fetch: async (url) => {
      if (String(url).includes("/trips/")) {
        const id = decodeURIComponent(String(url).split("/trips/")[1].split("?")[0]);
        return jsonResponse(detailPayload(id));
      }
      return jsonResponse({
        trips: ["a", "b", "c"].map((id) => listPayload(id).trips[0]),
      });
    },
  });

  const payload = await feed.getPayload(["U7"]);
  const withStops = payload.lines.U7.filter((trip) => trip.stops).length;
  assert.equal(withStops, 1);
  assert.equal(payload.count, 3);
});

test("normalizes stop names and stopovers", () => {
  assert.equal(cleanStopName("S+U Alexanderplatz Bhf (Berlin)"), "Alexanderplatz Bhf");
  assert.equal(cleanStopName("U Stadtmitte (Berlin)"), "Stadtmitte");
  const stops = normalizeStopovers(detailPayload("x").trip);
  assert.equal(stops.length, 2);
  assert.equal(stops[0].arr, stops[0].dep, "missing arrival falls back to departure");
});

test("rejects requests without valid lines", async () => {
  const response = responseRecorder();
  await handler({ method: "GET", query: { lines: "bus,invalid" } }, response);
  assert.equal(response.statusCode, 400);
});
