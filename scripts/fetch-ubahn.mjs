/**
 * Bakes the Berlin U-Bahn network into public/geo/berlin-ubahn.geojson.
 *
 * Two independent stages, so either can be refreshed without the other:
 *
 *   tracks   — route geometry from OpenStreetMap (Overpass). Each line
 *              (U1…U9) becomes one stitched LineString with its BVG colour.
 *   stations — every stop from BVG's own timetable (the same ids and
 *              coordinates the live feed uses, so trains halt exactly on
 *              them). Stations are Point features tagged with the lines that
 *              serve them; each track additionally lists its stop ids in
 *              travel order.
 *
 * The result is committed, so builds and page loads never depend on either
 * service being up. Re-run only when the network changes.
 *
 * Run with:
 *   npm run fetch-ubahn                    # both stages
 *   npm run fetch-ubahn -- --stations-only # keep the committed tracks
 *   npm run fetch-ubahn -- --tracks-only   # keep the committed stations
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "geo");
const outFile = join(outDir, "berlin-ubahn.geojson");
mkdirSync(outDir, { recursive: true });

const args = new Set(process.argv.slice(2));
const doTracks = !args.has("--stations-only");
const doStations = !args.has("--tracks-only");

const LINE_REFS = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9"];

// Official BVG line colours, used when OSM doesn't carry a colour tag.
const FALLBACK_COLORS = {
  U1: "#7DAD4C",
  U2: "#DA421E",
  U3: "#16683D",
  U4: "#F0D722",
  U5: "#7E5330",
  U6: "#8C6DAB",
  U7: "#528DBA",
  U8: "#224F86",
  U9: "#F3791D",
};

const USER_AGENT = "baselhasan-website/1.0 (build script)";

const existing = existsSync(outFile)
  ? JSON.parse(readFileSync(outFile, "utf8"))
  : { type: "FeatureCollection", features: [] };

let trackFeatures = existing.features.filter((f) => f.geometry?.type === "LineString");
let stationFeatures = existing.features.filter((f) => f.geometry?.type === "Point");

/* ------------------------------------------------------------------------ */
/* Stage 1: tracks from OpenStreetMap                                         */
/* ------------------------------------------------------------------------ */

// Overpass rejects requests without a User-Agent, and the main instance is
// often busy, so try the public mirrors in turn.
// (overpass.osm.ch only holds Switzerland, so it is deliberately not listed.)
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const QUERY = `[out:json][timeout:170];
rel["type"="route"]["route"="subway"](52.30,13.05,52.70,13.80);
out geom;`;

async function fetchOverpass() {
  let lastError = "";

  for (const url of OVERPASS_MIRRORS) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "POST",
          body: new URLSearchParams({ data: QUERY }),
          headers: { "User-Agent": USER_AGENT },
        });

        if (response.ok) {
          console.log(`  via ${new URL(url).host}`);
          return await response.json();
        }

        lastError = `${new URL(url).host} responded ${response.status}`;
      } catch (error) {
        lastError = `${new URL(url).host}: ${error.message}`;
      }

      console.log(`  ${lastError} — retrying (${attempt}/3)`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
    }
  }

  throw new Error(`Overpass unavailable. Last error: ${lastError}`);
}

/** Metres between two [lng, lat] points (flat approximation, fine here). */
function gapMetres(a, b) {
  const cos = Math.cos((52.52 * Math.PI) / 180);
  const dx = (b[0] - a[0]) * cos * 111320;
  const dy = (b[1] - a[1]) * 111320;
  return Math.hypot(dx, dy);
}

/** Small breaks in OSM relations (unsnapped way ends) are bridged. */
const STITCH_GAP_M = 45;

/**
 * Joins the relation's member ways into one continuous run of coordinates.
 * Exact endpoint matches are preferred; when none is left, the nearest way
 * end within STITCH_GAP_M is bridged so a single missing node in OSM doesn't
 * cut a line short.
 */
function stitchWays(ways) {
  if (!ways.length) return [];

  const remaining = ways.slice(1);
  let chain = ways[0].slice();

  while (remaining.length) {
    const head = chain[0];
    const tail = chain[chain.length - 1];
    let best = null;

    for (let i = 0; i < remaining.length; i += 1) {
      const way = remaining[i];
      const candidates = [
        { gap: gapMetres(tail, way[0]), attach: () => chain.concat(way.slice(1)) },
        { gap: gapMetres(tail, way[way.length - 1]), attach: () => chain.concat(way.slice().reverse().slice(1)) },
        { gap: gapMetres(head, way[way.length - 1]), attach: () => way.slice(0, -1).concat(chain) },
        { gap: gapMetres(head, way[0]), attach: () => way.slice().reverse().slice(0, -1).concat(chain) },
      ];
      candidates.forEach((candidate) => {
        if (!best || candidate.gap < best.gap) best = { ...candidate, index: i };
      });
    }

    if (!best || best.gap > STITCH_GAP_M) break;
    chain = best.attach();
    remaining.splice(best.index, 1);
  }

  return chain;
}

function roundCoords(coords, precision = 5) {
  const factor = 10 ** precision;
  return coords.map((pair) => [
    Math.round(pair[0] * factor) / factor,
    Math.round(pair[1] * factor) / factor,
  ]);
}

async function buildTracks() {
  console.log("Fetching Berlin U-Bahn tracks from Overpass...");

  const data = await fetchOverpass();
  console.log(`  ${data.elements.length} route relations returned`);

  // Each line has one relation per direction; the geometry is the same track,
  // so keep whichever direction stitches into the longest continuous run.
  const byLine = new Map();

  data.elements.forEach((relation) => {
    const ref = relation.tags?.ref;
    if (!ref || !/^U\d+$/.test(ref)) return;

    const ways = (relation.members || [])
      .filter((member) => member.type === "way" && !member.role && member.geometry)
      .map((member) => member.geometry.map((point) => [point.lon, point.lat]));

    const chain = stitchWays(ways);
    if (chain.length < 2) return;

    const metres = turf.length(turf.lineString(chain), { units: "meters" });
    const current = byLine.get(ref);
    if (!current || metres > current.metres) {
      byLine.set(ref, {
        chain,
        metres,
        color: relation.tags?.colour || FALLBACK_COLORS[ref] || "#111827",
        name: relation.tags?.name || ref,
      });
    }
  });

  const features = [...byLine.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([ref, { chain, color }]) => {
      const line = turf.lineString(roundCoords(chain), {
        ref,
        color: color.toUpperCase(),
      });

      const simplified = turf.simplify(line, {
        tolerance: 0.00008,
        highQuality: true,
      });
      simplified.properties = { ref, color: color.toUpperCase() };
      simplified.geometry.coordinates = roundCoords(simplified.geometry.coordinates);

      const km = turf.length(simplified, { units: "kilometers" });
      console.log(
        `  ${ref.padEnd(3)} ${String(simplified.geometry.coordinates.length).padStart(5)} pts  ${km.toFixed(1).padStart(5)} km  ${simplified.properties.color}`
      );

      return simplified;
    });

  if (!features.length) {
    throw new Error("No U-Bahn lines found — check the Overpass query.");
  }

  return features;
}

/* ------------------------------------------------------------------------ */
/* Stage 2: stations from BVG                                                 */
/* ------------------------------------------------------------------------ */

const BVG = "https://v6.bvg.transport.rest";
/** A stop this close to a track is served by that line. */
const STATION_ON_TRACK_M = 60;

function cleanStopName(name) {
  return String(name || "")
    .replace(/\s*\(Berlin\)\s*/g, "")
    .replace(/^(S\+U|U|S)\s+/, "")
    .trim();
}

async function bvgJson(path, params) {
  const url = new URL(path, BVG);
  url.search = new URLSearchParams(params).toString();
  let lastStatus = "";
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (response.ok) return response.json();
    // HAFAS answers "no running trips" with 404 NO_MATCH — an empty result.
    if (response.status === 404) {
      const body = await response.json().catch(() => null);
      if (body?.hafasCode === "NO_MATCH" || body?.code === "NOT_FOUND") return { trips: [] };
    }
    lastStatus = String(response.status);
    // 429 is the public API's rate limit (100 requests/minute): back off hard.
    const wait = response.status === 429 ? 20000 : attempt * 2000;
    console.log(`  BVG ${response.status} for ${path} — waiting ${wait / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  throw new Error(`BVG unavailable for ${path} (last status ${lastStatus})`);
}

/** Tomorrow 12:00 Berlin time, when every line runs its full route. */
function middayWindow() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(10, 0, 0, 0); // 12:00 CEST / 11:00 CET — either is midday
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { fromWhen: start.toISOString(), untilWhen: end.toISOString() };
}

async function collectStations() {
  console.log("Fetching Berlin U-Bahn stations from BVG...");
  const stations = new Map();
  const window = middayWindow();

  for (const ref of LINE_REFS) {
    const queries = [
      { lineName: ref, onlyCurrentlyRunning: "false", ...window },
      { lineName: ref, onlyCurrentlyRunning: "true" },
    ];
    const byRoute = new Map();

    for (const query of queries) {
      const data = await bvgJson("/trips", {
        ...query,
        stopovers: "false",
        remarks: "false",
        polylines: "false",
      });
      (data.trips || []).forEach((trip) => {
        if (trip.cancelled || !trip.id) return;
        const key = `${trip.origin?.id}>${trip.destination?.id}`;
        if (!byRoute.has(key)) byRoute.set(key, trip.id);
      });
    }

    let added = 0;
    for (const tripId of byRoute.values()) {
      const data = await bvgJson(`/trips/${encodeURIComponent(tripId)}`, {
        stopovers: "true",
        remarks: "false",
        polylines: "false",
      });
      const trip = data.trip || data;
      (trip.stopovers || []).forEach((stopover) => {
        const stop = stopover.stop;
        const lat = Number(stop?.location?.latitude);
        const lng = Number(stop?.location?.longitude);
        if (!stop?.id || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const id = String(stop.id);
        if (!stations.has(id)) {
          stations.set(id, { id, name: cleanStopName(stop.name), lat, lng, lines: new Set() });
          added += 1;
        }
        stations.get(id).lines.add(ref);
      });
    }
    console.log(`  ${ref.padEnd(3)} ${byRoute.size} route variants, ${added} new stations`);
  }

  return stations;
}

/**
 * OSM subway station nodes, used to fill in stations that no current trip
 * serves (a stretch closed for construction still has its stations).
 */
async function fetchOsmStations() {
  const query = `[out:json][timeout:60];
node["railway"="station"]["station"="subway"](52.30,13.05,52.70,13.80);
out;`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    for (const url of OVERPASS_MIRRORS) {
      try {
        const response = await fetch(url, {
          method: "POST",
          body: new URLSearchParams({ data: query }),
          headers: { "User-Agent": USER_AGENT },
        });
        if (!response.ok) continue;
        const data = await response.json();
        const nodes = (data.elements || []).filter((node) => node.tags?.name && Number.isFinite(node.lat));
        if (!nodes.length) continue;
        console.log(`  ${nodes.length} OSM station nodes via ${new URL(url).host}`);
        return nodes;
      } catch {
        // try the next mirror
      }
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 6000));
  }
  console.log("  OSM stations unavailable — skipping the fill-in");
  return [];
}

/** A BVG stop within this distance of an OSM node is the same station. */
const SAME_STATION_M = 150;

/* --- snapping helpers (same flat projection the map layer uses) ----------- */

const EARTH_R = 6371000;
const COS_LAT0 = Math.cos((52.52 * Math.PI) / 180);
const projectX = (lng) => ((lng * Math.PI) / 180) * COS_LAT0 * EARTH_R;
const projectY = (lat) => ((lat * Math.PI) / 180) * EARTH_R;

function trackPoints(feature) {
  const points = feature.geometry.coordinates.map(([lng, lat]) => ({
    x: projectX(lng),
    y: projectY(lat),
  }));
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return { points, cumulative };
}

function snap(track, lat, lng) {
  const px = projectX(lng);
  const py = projectY(lat);
  let bestOffset = Infinity;
  let bestDistance = 0;

  for (let i = 0; i < track.points.length - 1; i += 1) {
    const a = track.points[i];
    const b = track.points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    let t = lengthSq > 0 ? ((px - a.x) * dx + (py - a.y) * dy) / lengthSq : 0;
    t = Math.max(0, Math.min(1, t));
    const offset = Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
    if (offset < bestOffset) {
      bestOffset = offset;
      bestDistance = track.cumulative[i] + t * Math.sqrt(lengthSq);
    }
  }
  return { offset: bestOffset, distance: bestDistance };
}

function flatDistance(a, b) {
  return Math.hypot(projectX(a.lng) - projectX(b.lng), projectY(a.lat) - projectY(b.lat));
}

/** Adds OSM stations that sit on a track but match no BVG stop. */
function fillStationsFromOsm(tracks, stations, osmNodes) {
  const tracksByRef = new Map(tracks.map((feature) => [feature.properties.ref, trackPoints(feature)]));
  let added = 0;

  osmNodes.forEach((node) => {
    const candidate = { lat: node.lat, lng: node.lon };
    const onLines = [...tracksByRef.entries()]
      .filter(([, track]) => snap(track, candidate.lat, candidate.lng).offset <= STATION_ON_TRACK_M)
      .map(([ref]) => ref);
    if (!onLines.length) return;

    const known = [...stations.values()].some(
      (station) => flatDistance(station, candidate) <= SAME_STATION_M
    );
    if (known) return;

    const id = `osm:${node.id}`;
    stations.set(id, {
      id,
      name: cleanStopName(node.tags.name),
      lat: candidate.lat,
      lng: candidate.lng,
      lines: new Set(onLines),
    });
    added += 1;
    console.log(`  + ${cleanStopName(node.tags.name)} (${onLines.join(", ")}) from OSM`);
  });

  console.log(`  ${added} stations filled in from OSM`);
}

/** Beyond this a timetable stop is off the baked geometry, not on it. */
const MAX_TRACK_OFFSET_M = 400;

/**
 * Assigns stations to tracks by geometry as well as by timetable, so a line
 * whose service is currently truncated (construction shuttles) still shows
 * every station along its rails.
 */
function attachStationsToTracks(tracks, stations) {
  const tracksByRef = new Map(tracks.map((feature) => [feature.properties.ref, trackPoints(feature)]));

  tracks.forEach((feature) => {
    const ref = feature.properties.ref;
    const track = tracksByRef.get(ref);
    const along = [];

    stations.forEach((station) => {
      const { offset, distance } = snap(track, station.lat, station.lng);
      if (offset > MAX_TRACK_OFFSET_M) {
        if (station.lines.has(ref)) {
          console.log(`  ! ${station.name} is ${offset.toFixed(0)} m off the ${ref} track — geometry incomplete?`);
          station.lines.delete(ref);
        }
        return;
      }
      if (station.lines.has(ref) || offset <= STATION_ON_TRACK_M) {
        station.lines.add(ref);
        along.push({ id: station.id, distance, offset });
      }
    });

    along.sort((a, b) => a.distance - b.distance);
    feature.properties = {
      ref,
      color: feature.properties.color,
      stops: along.map((entry) => entry.id),
    };

    const worst = along.reduce((max, entry) => Math.max(max, entry.offset), 0);
    console.log(`  ${ref.padEnd(3)} ${String(along.length).padStart(3)} stations on track, max offset ${worst.toFixed(0)} m`);
  });
}

/** Raw subway track ways in a bbox [south, west, north, east], sidings excluded. */
async function fetchSubwayWays(bbox) {
  // A section closed for works is often retagged construction/disused in OSM
  // while BVG keeps running it, so those count as track here too.
  const box = bbox.map((v) => v.toFixed(4)).join(",");
  const query = `[out:json][timeout:60];
(
  way["railway"="subway"](${box});
  way["railway"="construction"]["construction"="subway"](${box});
  way["disused:railway"="subway"](${box});
  way["railway"="disused"]["disused"="subway"](${box});
);
out geom;`;

  for (const url of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        headers: { "User-Agent": USER_AGENT },
      });
      if (!response.ok) continue;
      const data = await response.json();
      return (data.elements || [])
        .filter((way) => way.geometry && !way.tags?.service)
        .map((way) => way.geometry.map((point) => [point.lon, point.lat]));
    } catch {
      // try the next mirror
    }
  }
  return [];
}

/**
 * Finds a run of ways leading from `start` to within `reachM` of `goal`:
 * breadth-first over way ends that touch (within STITCH_GAP_M), so a dead-end
 * stub next to the platform is never mistaken for the through track.
 * Returns the ways' coordinates in travel order, or null.
 */
function findWayPath(start, ways, goal, reachM) {
  const oriented = [];
  ways.forEach((way, index) => {
    const reversed = way.slice().reverse();
    oriented.push({ index, coords: way, from: way[0], to: way[way.length - 1] });
    oriented.push({ index, coords: reversed, from: reversed[0], to: reversed[reversed.length - 1] });
  });

  const reaches = (entry) =>
    entry.coords.some((point) => gapMetres(point, goal) <= reachM);

  const visited = new Set();
  const queue = [];
  oriented.forEach((entry, id) => {
    if (gapMetres(start, entry.from) <= STITCH_GAP_M && !visited.has(entry.index)) {
      visited.add(entry.index);
      queue.push([id]);
    }
  });

  while (queue.length) {
    const path = queue.shift();
    const entry = oriented[path[path.length - 1]];
    if (reaches(entry)) return path.map((id) => oriented[id].coords);

    oriented.forEach((next, nextId) => {
      if (visited.has(next.index)) return;
      if (gapMetres(entry.to, next.from) <= STITCH_GAP_M) {
        visited.add(next.index);
        queue.push([...path, nextId]);
      }
    });
  }
  return null;
}

/**
 * OSM route relations are sometimes trimmed to the section currently in
 * regular service. When BVG's timetable still serves stations beyond the end
 * of a baked track, extend that track along raw subway ways to reach them.
 */
async function repairTracks(tracks, stations) {
  for (const feature of tracks) {
    const ref = feature.properties.ref;
    const coords = feature.geometry.coordinates;
    const track = trackPoints(feature);
    const far = [...stations.values()].filter(
      (station) => station.lines.has(ref) && snap(track, station.lat, station.lng).offset > MAX_TRACK_OFFSET_M
    );
    if (!far.length) continue;

    const goal = far.reduce(
      (best, station) => {
        const distance = Math.min(
          gapMetres(coords[0], [station.lng, station.lat]),
          gapMetres(coords[coords.length - 1], [station.lng, station.lat])
        );
        return distance > best.distance ? { station, distance } : best;
      },
      { station: far[0], distance: -1 }
    ).station;

    const nearEnd = [coords[0], coords[coords.length - 1]].sort(
      (a, b) => gapMetres(a, [goal.lng, goal.lat]) - gapMetres(b, [goal.lng, goal.lat])
    )[0];
    const lats = [nearEnd[1], ...far.map((station) => station.lat)];
    const lngs = [nearEnd[0], ...far.map((station) => station.lng)];
    const pad = 0.006;
    const bbox = [Math.min(...lats) - pad, Math.min(...lngs) - pad, Math.max(...lats) + pad, Math.max(...lngs) + pad];

    console.log(
      `  ${ref}: ${far.length} timetable stations beyond the track (${far.map((s) => s.name).join(", ")}) — extending from OSM ways`
    );
    const ways = await fetchSubwayWays(bbox);
    const path = findWayPath(nearEnd, ways, [goal.lng, goal.lat], 150);
    let extended = coords;
    if (path) {
      const pathCoords = path.flat();
      extended =
        nearEnd === coords[coords.length - 1]
          ? coords.concat(pathCoords)
          : pathCoords.reverse().concat(coords);
    }

    if (extended.length > coords.length) {
      const simplified = turf.simplify(turf.lineString(roundCoords(extended)), {
        tolerance: 0.00008,
        highQuality: true,
      });
      feature.geometry.coordinates = roundCoords(simplified.geometry.coordinates);
      const km = turf.length(feature, { units: "kilometers" });
      console.log(`    ${ref} now ${feature.geometry.coordinates.length} pts, ${km.toFixed(1)} km (OSM ways)`);
    } else {
      // Last resort: run the rails station to station. The U-Bahn is close to
      // straight between neighbouring stops, so this reads fine on the map and
      // keeps trains on their route rather than piling up at the track end.
      const ordered = far
        .map((station) => ({ station, distance: gapMetres(nearEnd, [station.lng, station.lat]) }))
        .sort((a, b) => a.distance - b.distance)
        .map(({ station }) => [station.lng, station.lat]);
      const fallback =
        nearEnd === coords[coords.length - 1] ? coords.concat(ordered) : ordered.reverse().concat(coords);
      feature.geometry.coordinates = roundCoords(fallback);
      const km = turf.length(feature, { units: "kilometers" });
      console.log(
        `    no OSM ways joined the ${ref} track — extended station to station, now ${km.toFixed(1)} km`
      );
    }
  }
}

function stationFeaturesFrom(stations) {
  return [...stations.values()]
    .filter((station) => station.lines.size)
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((station) => ({
      type: "Feature",
      properties: {
        kind: "station",
        id: station.id,
        name: station.name,
        lines: [...station.lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      },
      geometry: {
        type: "Point",
        coordinates: [Math.round(station.lng * 1e5) / 1e5, Math.round(station.lat * 1e5) / 1e5],
      },
    }));
}

/* ------------------------------------------------------------------------ */

if (doTracks) trackFeatures = await buildTracks();
if (!trackFeatures.length) throw new Error("No track geometry available.");

if (doStations) {
  const stations = await collectStations();
  await repairTracks(trackFeatures, stations);
  fillStationsFromOsm(trackFeatures, stations, await fetchOsmStations());
  attachStationsToTracks(trackFeatures, stations);
  stationFeatures = stationFeaturesFrom(stations);
} else if (stationFeatures.length) {
  // Re-derive the per-track stop order against the fresh geometry.
  const stations = new Map(
    stationFeatures.map((feature) => [
      feature.properties.id,
      {
        id: feature.properties.id,
        name: feature.properties.name,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        lines: new Set(feature.properties.lines),
      },
    ])
  );
  attachStationsToTracks(trackFeatures, stations);
  stationFeatures = stationFeaturesFrom(stations);
}

const collection = { type: "FeatureCollection", features: [...trackFeatures, ...stationFeatures] };
const json = JSON.stringify(collection);
writeFileSync(outFile, json);

console.log(
  `\nWrote public/geo/berlin-ubahn.geojson (${trackFeatures.length} lines, ${stationFeatures.length} stations, ${(
    Buffer.byteLength(json) / 1024
  ).toFixed(0)} KB)`
);
