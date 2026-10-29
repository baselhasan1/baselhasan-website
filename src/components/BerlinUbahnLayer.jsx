import { useEffect, useRef, useState } from "react";
import { DomUtil, Renderer } from "leaflet";
import { useMap } from "react-leaflet";
import { createBvgFeed } from "../data/bvgFeed.js";
import { readableInk } from "../data/ubahnLines.js";
import { assetUrl, loadGeoJson } from "../utils/loadGeoJson.js";
import "../ubahn.css";

/**
 * Live Berlin U-Bahn layer.
 *
 * Everything is drawn on two canvases that sit in Leaflet panes: a static one
 * for rails and stations (redrawn when the view settles) and a dynamic one for
 * trains (redrawn every frame). Drawing on canvas is what lets the rails carry
 * a proper casing, shared track (U1/U3) run side by side, stations sit exactly
 * on the rails, and a hundred trains glide at 30 fps without DOM churn.
 *
 * Train movement is driven by BVG's realtime timetable rather than by the
 * 20-second position snapshots: each trip's stop times are snapped onto the
 * baked track, and a train is interpolated between consecutive stops with a
 * short dwell at each one. Trips whose timetable hasn't arrived yet move
 * linearly origin → destination and are nudged towards the latest snapshot.
 * A trip that reaches its final stop, or drops out of the feed, fades away.
 */

const API = assetUrl("api/ubahn");
const NETWORK_URL = "geo/berlin-ubahn.geojson";

const POLL_MS = 20000;
const HIDDEN_POLL_MS = 60000;
const POLL_TIMEOUT_MS = 25000;
const FRAME_MS = 33;
const HIDDEN_TICK_MS = 1000;
/** BVG lists one time per stop; the train stands still for this long around it. */
const HALF_DWELL_S = 10;
const END_FADE_MS = 1400;
const FADE_IN_S = 0.45;
const MISSED_POLLS_TO_RETIRE = 2;
/** Timetable and snapshot disagreeing by more than this means the timetable is wrong. */
const MAX_TIMETABLE_DRIFT_M = 700;
const MAX_TIME_SHIFT_S = 300;
const SHARED_TRACK_M = 20;
const MIN_TRAIN_ZOOM = 10;
const HOVER_RADIUS_PX = 14;
const TAP_RADIUS_PX = 22;

/* --- flat-earth projection, plenty accurate across one city --------------- */

const EARTH_R = 6371000;
const COS_LAT0 = Math.cos((52.52 * Math.PI) / 180);

function projectX(lng) {
  return ((lng * Math.PI) / 180) * COS_LAT0 * EARTH_R;
}

function projectY(lat) {
  return ((lat * Math.PI) / 180) * EARTH_R;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatClock(seconds) {
  if (seconds == null) return "";
  return new Date(seconds * 1000).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

/* --- track geometry ------------------------------------------------------- */

function buildLine(feature) {
  const points = feature.geometry.coordinates.map(([lng, lat]) => ({
    lat,
    lng,
    x: projectX(lng),
    y: projectY(lat),
  }));

  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
  }

  return {
    ref: feature.properties.ref,
    color: feature.properties.color,
    points,
    cumulative,
    total: cumulative[cumulative.length - 1],
    // Per vertex: 0 = own track, ±1 = shared with another line, drawn offset.
    sides: new Int8Array(points.length),
  };
}

/** Nearest point on the line, as a distance along it plus how far off it was. */
function snapToLine(line, lat, lng) {
  const px = projectX(lng);
  const py = projectY(lat);

  let bestDistance = 0;
  let bestOffset = Infinity;

  for (let i = 0; i < line.points.length - 1; i += 1) {
    const a = line.points[i];
    const b = line.points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;

    let t = 0;
    if (lengthSq > 0) {
      t = ((px - a.x) * dx + (py - a.y) * dy) / lengthSq;
      t = clamp(t, 0, 1);
    }

    const offset = Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
    if (offset < bestOffset) {
      bestOffset = offset;
      bestDistance = line.cumulative[i] + t * Math.sqrt(lengthSq);
    }
  }

  return { distance: bestDistance, offset: bestOffset };
}

function pointAtDistance(line, distance) {
  const target = clamp(distance, 0, line.total);

  let low = 0;
  let high = line.cumulative.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (line.cumulative[mid] <= target) low = mid;
    else high = mid;
  }

  const a = line.points[low];
  const b = line.points[low + 1] || a;
  const span = line.cumulative[low + 1] - line.cumulative[low] || 1;
  const t = (target - line.cumulative[low]) / span;

  return [a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t];
}

/** Marks vertices where two lines run on the same track so they can be drawn side by side. */
function markSharedTrack(lines) {
  const list = [...lines.values()];
  for (let a = 0; a < list.length; a += 1) {
    for (let b = a + 1; b < list.length; b += 1) {
      const first = list[a];
      const second = list[b];
      let shared = false;
      first.points.forEach((point, index) => {
        if (snapToLine(second, point.lat, point.lng).offset < SHARED_TRACK_M) {
          first.sides[index] = -1;
          shared = true;
        }
      });
      if (!shared) continue;
      second.points.forEach((point, index) => {
        if (snapToLine(first, point.lat, point.lng).offset < SHARED_TRACK_M) {
          second.sides[index] = 1;
        }
      });
    }
  }
}

function buildStations(features, lines) {
  return features
    .map((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const refs = (feature.properties.lines || []).filter((ref) => lines.has(ref));
      if (!refs.length) return null;

      // Draw the station on the rails rather than at BVG's address point.
      const snaps = refs.map((ref) => {
        const line = lines.get(ref);
        const { distance } = snapToLine(line, lat, lng);
        const [snappedLat, snappedLng] = pointAtDistance(line, distance);
        return { ref, distance, lat: snappedLat, lng: snappedLng };
      });
      const centre = snaps.reduce(
        (sum, snap) => [sum[0] + snap.lat / snaps.length, sum[1] + snap.lng / snaps.length],
        [0, 0]
      );

      return {
        id: feature.properties.id,
        name: feature.properties.name,
        refs,
        lat: centre[0],
        lng: centre[1],
        interchange: refs.length > 1,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.interchange) - Number(a.interchange));
}

/* --- train motion model --------------------------------------------------- */

/**
 * Where a train with a full timetable is at time t (seconds): dwelling at a
 * stop for HALF_DWELL_S either side of its listed time, otherwise easing
 * between consecutive stops along the track.
 */
function timetablePosition(stops, t) {
  const first = stops[0];
  if (t < first.dep + HALF_DWELL_S) {
    return { d: first.d, moving: false, at: 0, next: 1, phase: "waiting" };
  }

  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i];
    const b = stops[i + 1];
    let leave = a.dep + HALF_DWELL_S;
    let arrive = b.arr - HALF_DWELL_S;
    if (arrive <= leave) {
      leave = (a.dep + b.arr) / 2;
      arrive = leave + 1;
    }
    if (t < leave) return { d: a.d, moving: false, at: i, next: i + 1, phase: "dwell" };
    if (t < arrive) {
      const u = (t - leave) / (arrive - leave);
      const eased = u * u * (3 - 2 * u);
      return { d: a.d + (b.d - a.d) * eased, moving: true, next: i + 1, phase: "moving" };
    }
  }

  const last = stops.length - 1;
  return {
    d: stops[last].d,
    moving: false,
    at: last,
    phase: "arrived",
    finished: t > stops[last].arr + HALF_DWELL_S,
  };
}

function linearPosition(train, t) {
  const shifted = t - train.shift;
  const canInterpolate =
    train.originD != null &&
    train.destD != null &&
    train.dep != null &&
    train.arr != null &&
    train.arr > train.dep;

  if (!canInterpolate) return { d: train.snapD, moving: false, phase: "unknown" };

  const u = clamp((shifted - train.dep) / (train.arr - train.dep), 0, 1);
  return {
    d: train.originD + (train.destD - train.originD) * u,
    moving: u > 0 && u < 1,
    phase: u <= 0 ? "waiting" : u >= 1 ? "arrived" : "moving",
    finished: shifted > train.arr + HALF_DWELL_S,
  };
}

function positionOf(train, t) {
  return train.stops ? timetablePosition(train.stops, t) : linearPosition(train, t);
}

/** Nudges a timetable-less train so its model passes through the latest snapshot. */
function reconcileLinear(train, t) {
  if (
    train.originD == null ||
    train.destD == null ||
    train.dep == null ||
    train.arr == null ||
    train.arr <= train.dep
  ) {
    return;
  }
  const speed = (train.destD - train.originD) / (train.arr - train.dep);
  if (!speed) return;

  const u = clamp((t - train.dep) / (train.arr - train.dep), 0, 1);
  const model = train.originD + (train.destD - train.originD) * u;
  const ahead = model - train.snapD;
  train.shiftTarget = clamp(ahead / speed, -MAX_TIME_SHIFT_S, MAX_TIME_SHIFT_S);
  if (train.fresh) train.shift = train.shiftTarget;
}

/* --- canvas layer --------------------------------------------------------- */

/**
 * A Leaflet renderer that hands its 2D context to a draw callback. Leaflet's
 * Renderer base already positions the canvas, pads it for panning and
 * CSS-scales it during zoom animations; this only adds the pixel-ratio-aware
 * sizing and the redraw hook.
 */
const CanvasLayer = Renderer.extend({
  options: { padding: 0.35 },

  initialize(draw, options) {
    Renderer.prototype.initialize.call(this, options);
    this._draw = draw;
  },

  _initContainer() {
    const canvas = document.createElement("canvas");
    canvas.className = `ubahn-canvas ${this.options.className || ""}`;
    this._container = canvas;
    this._ctx = canvas.getContext("2d");
  },

  _destroyContainer() {
    DomUtil.remove(this._container);
    delete this._ctx;
    delete this._container;
  },

  _updatePaths() {},

  _update() {
    if (this._map._animatingZoom && this._bounds) return;
    Renderer.prototype._update.call(this);

    const bounds = this._bounds;
    const size = bounds.getSize();
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const canvas = this._container;

    DomUtil.setPosition(canvas, bounds.min);
    canvas.width = Math.round(size.x * ratio);
    canvas.height = Math.round(size.y * ratio);
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    this._ctx.setTransform(ratio, 0, 0, ratio, -bounds.min.x * ratio, -bounds.min.y * ratio);
    this.redraw();
  },

  redraw() {
    if (!this._map || !this._ctx || !this._bounds || this._map._animatingZoom) return;
    const bounds = this._bounds;
    const size = bounds.getSize();
    this._ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y);
    this._draw(this._ctx, this._map, bounds);
  },
});

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arc(x + width - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + width, y + height - r);
  ctx.arc(x + width - r, y + height - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + height);
  ctx.arc(x + r, y + height - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
  ctx.closePath();
}

function railWidth(zoom) {
  if (zoom <= 11) return 2;
  if (zoom <= 13) return 3;
  if (zoom <= 15) return 4;
  return 5;
}

function trainScale(zoom) {
  if (zoom <= 11) return 0.55;
  if (zoom <= 12) return 0.7;
  if (zoom <= 13) return 0.85;
  if (zoom <= 14) return 1;
  if (zoom <= 15) return 1.15;
  return 1.3;
}

/**
 * Pushes the vertices of a shared stretch sideways so two lines on one track
 * both stay visible. The normal is normalised to point east-ish, so "side"
 * means the same geographic side whichever way each line was digitised.
 */
function offsetPolyline(points, sides, amount) {
  const count = points.length;
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const side = sides[i];
    if (!side) {
      out[i] = points[i];
      continue;
    }
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(count - 1, i + 1)];
    let nx = -(next.y - prev.y);
    let ny = next.x - prev.x;
    const length = Math.hypot(nx, ny) || 1;
    nx /= length;
    ny /= length;
    if (nx < 0 || (nx === 0 && ny < 0)) {
      nx = -nx;
      ny = -ny;
    }
    out[i] = { x: points[i].x + nx * side * amount, y: points[i].y + ny * side * amount };
  }
  return out;
}

function strokePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

function inBounds(point, bounds, pad) {
  return (
    point.x >= bounds.min.x - pad &&
    point.x <= bounds.max.x + pad &&
    point.y >= bounds.min.y - pad &&
    point.y <= bounds.max.y + pad
  );
}

/* --- component ------------------------------------------------------------ */

function BerlinUbahnLayer({ visibleLines, onStats }) {
  const map = useMap();
  const [network, setNetwork] = useState(null);

  // Held in refs so toggling a line adjusts the existing layer instead of
  // tearing it down and re-polling everything.
  const visibleRef = useRef(visibleLines);
  const applyVisibilityRef = useRef(null);

  useEffect(() => {
    visibleRef.current = visibleLines;
    applyVisibilityRef.current?.();
  }, [visibleLines]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    loadGeoJson(NETWORK_URL, { signal: controller.signal })
      .then((data) => {
        if (!cancelled) setNetwork(data);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error loading berlin-ubahn.geojson:", error);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!network?.features?.length) return undefined;

    /* --- network ------------------------------------------------------- */

    const lines = new Map();
    network.features
      .filter((feature) => feature.geometry?.type === "LineString")
      .forEach((feature) => lines.set(feature.properties.ref, buildLine(feature)));
    markSharedTrack(lines);

    const stations = buildStations(
      network.features.filter((feature) => feature.geometry?.type === "Point"),
      lines
    );

    if (!map.getPane("ubahnLinePane")) map.createPane("ubahnLinePane").style.zIndex = 552;
    if (!map.getPane("ubahnTrainPane")) map.createPane("ubahnTrainPane").style.zIndex = 585;

    /* --- state --------------------------------------------------------- */

    const trains = new Map();
    const hitTargets = [];
    const directFeed = createBvgFeed({ detailBudgetPerMinute: 40 });
    let skewMs = 0;
    let stopped = false;
    let zooming = false;
    let pollTimer = null;
    let pollInFlight = false;
    const activeRequests = new Set();
    let hovered = null;
    let pinned = null;

    const isVisible = (ref) => visibleRef.current.has(ref);
    const modelNow = () => (Date.now() + skewMs) / 1000;

    /* --- drawing: rails + stations ------------------------------------- */

    function drawNetwork(ctx, leafletMap, bounds) {
      const zoom = leafletMap.getZoom();
      const width = railWidth(zoom);
      const shown = [...lines.values()].filter((line) => isVisible(line.ref));
      if (!shown.length) return;

      const projected = shown.map((line) => {
        const raw = line.points.map((point) => leafletMap.latLngToLayerPoint([point.lat, point.lng]));
        return { line, points: offsetPolyline(raw, line.sides, width * 0.55 + 0.6) };
      });

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.strokeStyle = "rgba(18, 16, 22, 0.58)";
      ctx.lineWidth = width + 3;
      projected.forEach((entry) => strokePath(ctx, entry.points));

      ctx.lineWidth = width;
      projected.forEach((entry) => {
        ctx.strokeStyle = entry.line.color;
        strokePath(ctx, entry.points);
      });

      if (zoom < 12) return;

      const radius = zoom <= 12 ? 2.2 : zoom <= 13 ? 2.8 : zoom <= 14 ? 3.4 : zoom <= 15 ? 4 : 4.6;
      const labelAll = zoom >= 15;
      const labelInterchanges = zoom >= 14;
      // Fixed, like every other name on the map: zoom decides which
      // stations are named, never how the names are drawn.
      const fontSize = 11;
      const placed = [];

      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      stations.forEach((station) => {
        if (!station.refs.some(isVisible)) return;
        if (zoom <= 12 && !station.interchange) return;

        const point = leafletMap.latLngToLayerPoint([station.lat, station.lng]);
        if (!inBounds(point, bounds, 80)) return;

        const r = station.interchange ? radius * 1.3 : radius;
        ctx.beginPath();
        ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = station.interchange ? 2 : 1.4;
        ctx.strokeStyle = "rgba(28, 25, 23, 0.9)";
        ctx.stroke();

        const wantsLabel = labelAll || (labelInterchanges && station.interchange);
        if (!wantsLabel) return;

        ctx.font = `${station.interchange ? 700 : 600} ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
        const textWidth = ctx.measureText(station.name).width;
        const box = { x: point.x + r + 4, y: point.y - fontSize * 0.7, w: textWidth + 2, h: fontSize * 1.4 };
        const collides = placed.some(
          (other) =>
            box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y
        );
        if (collides) return;
        placed.push(box);

        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
        ctx.lineJoin = "round";
        ctx.strokeText(station.name, box.x + 1, point.y);
        ctx.fillStyle = "#1c1917";
        ctx.fillText(station.name, box.x + 1, point.y);
      });
    }

    /* --- drawing: trains ----------------------------------------------- */

    function headingAt(leafletMap, line, distance, sign) {
      const from = leafletMap.latLngToLayerPoint(pointAtDistance(line, Math.max(0, distance - 8)));
      const to = leafletMap.latLngToLayerPoint(pointAtDistance(line, Math.min(line.total, distance + 8)));
      let angle = Math.atan2(to.y - from.y, to.x - from.x);
      if (sign < 0) angle += Math.PI;
      return angle;
    }

    function drawTrains(ctx, leafletMap, bounds) {
      const zoom = leafletMap.getZoom();
      hitTargets.length = 0;
      // Zoomed out past the city, trains would just pile into a blob.
      if (zoom < MIN_TRAIN_ZOOM) return;
      const scale = trainScale(zoom);
      const length = 25 * scale;
      const width = 12.5 * scale;
      const radius = width / 2;
      const showLabel = zoom >= 15;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      trains.forEach((train) => {
        const pos = train.pos;
        if (!pos || train.alpha <= 0) return;

        const point = leafletMap.latLngToLayerPoint(pointAtDistance(train.line, pos.d));
        if (!inBounds(point, bounds, 40)) {
          train.screen = null;
          return;
        }

        const angle = headingAt(leafletMap, train.line, pos.d, train.sign);
        const active = train.id === hovered || train.id === pinned;

        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(angle);
        ctx.globalAlpha = train.alpha;

        ctx.fillStyle = "rgba(15, 23, 42, 0.38)";
        roundRect(ctx, -length / 2 + 0.5, -width / 2 + 1.6, length, width, radius);
        ctx.fill();

        ctx.fillStyle = train.color;
        roundRect(ctx, -length / 2, -width / 2, length, width, radius);
        ctx.fill();
        ctx.lineWidth = active ? 2 : 1.2;
        ctx.strokeStyle = active ? "#111827" : "rgba(255, 255, 255, 0.92)";
        ctx.stroke();

        // Windscreen band at the front so the direction of travel reads at a glance.
        ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
        roundRect(ctx, length / 2 - 5.2 * scale, -width / 2 + 2.4 * scale, 2.2 * scale, width - 4.8 * scale, 1);
        ctx.fill();

        if (showLabel) {
          ctx.rotate(-angle);
          ctx.font = `800 ${Math.round(8.5 * scale)}px Inter, ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle = readableInk(train.color);
          ctx.fillText(train.ref, 0, 0.5);
        }
        ctx.restore();

        const container = leafletMap.layerPointToContainerPoint(point);
        train.screen = container;
        hitTargets.push({ id: train.id, x: container.x, y: container.y });
      });
    }

    const networkLayer = new CanvasLayer(drawNetwork, {
      pane: "ubahnLinePane",
      className: "ubahn-canvas--network",
    }).addTo(map);
    const trainLayer = new CanvasLayer(drawTrains, {
      pane: "ubahnTrainPane",
      className: "ubahn-canvas--trains",
    }).addTo(map);

    /* --- hover card ---------------------------------------------------- */

    const card = DomUtil.create("div", "ubahn-card", map.getContainer());
    let cardFor = null;
    let cardStamp = 0;

    function describe(train) {
      const pos = train.pos || {};
      const stops = train.stops;
      let where = "";

      if (stops) {
        if (pos.phase === "waiting") {
          where = `Waiting at <b>${escapeHtml(stops[0].name)}</b> · departs ${formatClock(stops[0].dep)}`;
        } else if (pos.phase === "dwell") {
          const stop = stops[pos.at];
          where = `At <b>${escapeHtml(stop.name)}</b> · departs ${formatClock(stop.dep)}`;
        } else if (pos.phase === "moving") {
          const stop = stops[pos.next];
          where = `Next <b>${escapeHtml(stop.name)}</b> · ${formatClock(stop.arr)}`;
        } else {
          const stop = stops[stops.length - 1];
          where = `Terminates at <b>${escapeHtml(stop.name)}</b>`;
        }
      } else if (pos.phase === "waiting") {
        where = `Waiting at <b>${escapeHtml(train.from)}</b> · departs ${formatClock(train.dep)}`;
      } else if (pos.phase === "arrived") {
        where = `Terminates at <b>${escapeHtml(train.to)}</b>`;
      } else {
        where = `Towards <b>${escapeHtml(train.to)}</b> · arrives ${formatClock(train.arr)}`;
      }

      const delay = train.delay != null && Math.abs(train.delay) >= 60
        ? `<div class="ubahn-card__meta">${train.delay > 0 ? "+" : "−"}${Math.round(Math.abs(train.delay) / 60)} min ${train.delay > 0 ? "late" : "early"}</div>`
        : "";

      return `<div class="ubahn-card__head"><span class="ubahn-badge" style="background:${train.color};color:${readableInk(
        train.color
      )}">${train.ref}</span><span>→ ${escapeHtml(train.dir || train.to)}</span></div><div class="ubahn-card__meta">${where}</div>${delay}`;
    }

    function updateCard() {
      const id = pinned || hovered;
      const train = id ? trains.get(id) : null;
      if (!train || !train.screen) {
        card.classList.remove("is-visible");
        cardFor = null;
        return;
      }
      card.style.left = `${train.screen.x}px`;
      card.style.top = `${train.screen.y - 8}px`;
      const now = performance.now();
      if (cardFor !== id || now - cardStamp > 1000) {
        card.innerHTML = describe(train);
        cardFor = id;
        cardStamp = now;
      }
      card.classList.add("is-visible");
    }

    function nearestTrain(x, y, radius) {
      let best = null;
      let bestDistance = radius * radius;
      for (const target of hitTargets) {
        const dx = target.x - x;
        const dy = target.y - y;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = target.id;
        }
      }
      return best;
    }

    const container = map.getContainer();
    const onMouseMove = (event) => {
      const id = nearestTrain(event.containerPoint.x, event.containerPoint.y, HOVER_RADIUS_PX);
      if (id !== hovered) {
        hovered = id;
        container.style.cursor = id ? "pointer" : "";
      }
    };
    const onMouseOut = () => {
      hovered = null;
      container.style.cursor = "";
    };
    const onClick = (event) => {
      const id = nearestTrain(event.containerPoint.x, event.containerPoint.y, TAP_RADIUS_PX);
      pinned = id && id !== pinned ? id : null;
    };

    map.on("mousemove", onMouseMove);
    map.on("mouseout", onMouseOut);
    map.on("click", onClick);

    /* --- feed ---------------------------------------------------------- */

    function retire(train) {
      if (!train.ending) train.ending = performance.now();
    }

    function ingest(payload, refs) {
      const now = Date.now();
      if (Number.isFinite(payload.now)) skewMs = payload.now - now;
      const t = modelNow();
      const seen = new Set();

      refs.forEach((ref) => {
        const line = lines.get(ref);
        const trips = payload.lines?.[ref];
        if (!line || !trips || !isVisible(ref)) return;

        trips.forEach((trip) => {
          if (trip.lat == null || trip.lng == null) return;
          seen.add(trip.id);
          const snap = snapToLine(line, trip.lat, trip.lng);

          let train = trains.get(trip.id);
          if (!train) {
            train = {
              id: trip.id,
              ref,
              line,
              color: line.color,
              stops: null,
              originD: null,
              destD: null,
              shift: 0,
              shiftTarget: 0,
              sign: 1,
              alpha: 0,
              missed: 0,
              ending: null,
              pos: null,
              screen: null,
              fresh: true,
            };
            trains.set(trip.id, train);
          }

          train.missed = 0;
          train.dir = trip.dir || train.dir || "";
          train.to = trip.to || train.to || "";
          train.from = trip.from || train.from || "";
          train.dep = trip.dep;
          train.arr = trip.arr;
          train.delay = trip.delay;
          train.snapD = snap.distance;
          if (trip.o) train.originD = snapToLine(line, trip.o[0], trip.o[1]).distance;
          if (trip.d) train.destD = snapToLine(line, trip.d[0], trip.d[1]).distance;

          if (trip.stops && trip.stops.length >= 2) {
            const stops = trip.stops.map(([lat, lng, arr, dep, name]) => ({
              d: snapToLine(line, lat, lng).distance,
              arr,
              dep,
              name,
            }));
            const drift = Math.abs(timetablePosition(stops, t).d - snap.distance);
            train.stops = drift <= MAX_TIMETABLE_DRIFT_M ? stops : null;
          }

          if (train.stops) {
            const stops = train.stops;
            train.sign = Math.sign(stops[stops.length - 1].d - stops[0].d) || 1;
          } else {
            if (train.originD != null && train.destD != null) {
              train.sign = Math.sign(train.destD - train.originD) || 1;
            }
            reconcileLinear(train, t);
          }
          train.fresh = false;
        });
      });

      trains.forEach((train) => {
        if (!refs.includes(train.ref) || seen.has(train.id)) return;
        train.missed += 1;
        if (train.missed >= MISSED_POLLS_TO_RETIRE) retire(train);
      });
    }

    // Latest feed count per line; a poll may cover only the lines just switched
    // on, so the total is always summed from here rather than from one payload.
    const lineCounts = new Map();

    function reportStats(status, payload = null, source = "proxy") {
      if (payload?.lines) {
        Object.entries(payload.lines).forEach(([ref, trips]) => {
          lineCounts.set(ref, trips.length);
        });
      }
      const byLine = {};
      let count = 0;
      visibleRef.current.forEach((ref) => {
        const n = lineCounts.get(ref);
        if (n == null) return;
        byLine[ref] = n;
        count += n;
      });
      onStats?.({
        status,
        trains: count,
        byLine,
        updatedAt: status === "live" ? Date.now() : null,
        source,
        feed: payload?.source === "vbb" ? "VBB" : "BVG",
      });
    }

    async function pollLines(refs) {
      const pending = refs.filter((ref) => lines.has(ref));
      if (stopped || pollInFlight || !pending.length) return;

      pollInFlight = true;
      const controller = new AbortController();
      activeRequests.add(controller);
      // A poll that hangs (BVG hiccup) must not block every later poll.
      let timedOut = false;
      const watchdog = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, POLL_TIMEOUT_MS);
      try {
        let payload = null;
        let source = "proxy";
        try {
          const response = await fetch(`${API}?lines=${encodeURIComponent(pending.join(","))}`, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          const contentType = response.headers.get("content-type") || "";
          if (!response.ok || !contentType.includes("json")) {
            throw new Error(`Live U-Bahn proxy returned ${response.status}`);
          }
          payload = await response.json();
          if (!payload?.lines) throw new Error("Live U-Bahn proxy returned no lines");
        } catch (proxyError) {
          if (proxyError.name === "AbortError") throw proxyError;
          source = "direct";
          payload = await directFeed.getPayload(pending, { signal: controller.signal });
        }

        if (stopped) return;
        ingest(payload, pending);
        const failed = Object.keys(payload.errors || {}).length;
        reportStats(failed >= pending.length ? "error" : "live", payload, source);
      } catch (error) {
        if (!stopped && (error.name !== "AbortError" || timedOut)) reportStats("error");
      } finally {
        clearTimeout(watchdog);
        activeRequests.delete(controller);
        pollInFlight = false;
      }
    }

    function pollAll() {
      if (stopped) return Promise.resolve();
      return pollLines([...visibleRef.current]);
    }

    // Background tabs keep polling, just slowly, so the picture is current the
    // moment the tab is looked at again.
    async function pollAndSchedule() {
      if (stopped) return;
      await pollAll();
      if (!stopped) {
        pollTimer = setTimeout(pollAndSchedule, document.hidden ? HIDDEN_POLL_MS : POLL_MS);
      }
    }

    /**
     * Reconciles the layer with the current line selection: rails, stations
     * and trains of hidden lines come off the map, and a line switched back
     * on is refreshed straight away rather than waiting for the next poll.
     */
    function applyVisibility(refreshMissing = true) {
      if (stopped) return;
      const selected = visibleRef.current;
      const linesWithTrains = new Set();

      [...trains.entries()].forEach(([id, train]) => {
        if (selected.has(train.ref)) linesWithTrains.add(train.ref);
        else {
          trains.delete(id);
          if (hovered === id) hovered = null;
          if (pinned === id) pinned = null;
        }
      });

      networkLayer.redraw();
      trainLayer.redraw();
      if (lineCounts.size) reportStats("live");

      const missing = [...selected].filter((ref) => !linesWithTrains.has(ref));
      if (refreshMissing && missing.length) pollLines(missing);
    }

    applyVisibilityRef.current = applyVisibility;

    // Dev-only peek at the live model (used by the browser checks); stripped
    // from production builds.
    if (import.meta.env.DEV) window.__ubahnDebug = { trains, stations, lines, modelNow };

    onStats?.({ status: "loading", trains: 0, byLine: {}, updatedAt: null, source: null });
    networkLayer.redraw();
    pollAndSchedule();

    /* --- animation ------------------------------------------------------ */

    let frameId;
    let lastFrame = 0;
    const tick = (timestamp) => {
      const dt = Math.min(0.25, (timestamp - lastFrame) / 1000 || FRAME_MS / 1000);
      lastFrame = timestamp;

      const t = modelNow();
      const now = performance.now();

      [...trains.entries()].forEach(([id, train]) => {
        if (!train.stops) train.shift += (train.shiftTarget - train.shift) * Math.min(1, dt / 3);
        train.pos = positionOf(train, t);
        if (train.pos.finished) retire(train);

        if (train.ending) {
          train.alpha = Math.max(0, 1 - (now - train.ending) / END_FADE_MS);
          if (train.alpha <= 0) {
            trains.delete(id);
            if (hovered === id) hovered = null;
            if (pinned === id) pinned = null;
          }
        } else {
          train.alpha = Math.min(1, train.alpha + dt / FADE_IN_S);
        }
      });

      if (!zooming) trainLayer.redraw();
      updateCard();
    };

    const step = (timestamp) => {
      frameId = requestAnimationFrame(step);
      if (document.hidden) return;
      if (timestamp - lastFrame < FRAME_MS) return;
      tick(timestamp);
    };

    // requestAnimationFrame pauses in hidden tabs; a slow timer keeps the
    // model (and the canvas) roughly current so nothing jumps on return.
    const hiddenTimer = setInterval(() => {
      if (document.hidden) tick(performance.now());
    }, HIDDEN_TICK_MS);

    const onZoomStart = () => {
      zooming = true;
      trainLayer._container?.classList.add("is-zooming");
    };
    const onZoomEnd = () => {
      zooming = false;
      trainLayer._container?.classList.remove("is-zooming");
      trainLayer.redraw();
    };
    map.on("zoomstart", onZoomStart);
    map.on("zoomend", onZoomEnd);

    frameId = requestAnimationFrame(step);

    const onVisibility = () => {
      if (!document.hidden) {
        lastFrame = 0;
        clearTimeout(pollTimer);
        pollAndSchedule();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      clearTimeout(pollTimer);
      clearInterval(hiddenTimer);
      activeRequests.forEach((controller) => controller.abort());
      activeRequests.clear();
      cancelAnimationFrame(frameId);
      map.off("zoomstart", onZoomStart);
      map.off("zoomend", onZoomEnd);
      map.off("mousemove", onMouseMove);
      map.off("mouseout", onMouseOut);
      map.off("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
      container.style.cursor = "";
      if (import.meta.env.DEV && window.__ubahnDebug?.trains === trains) delete window.__ubahnDebug;
      DomUtil.remove(card);
      map.removeLayer(trainLayer);
      map.removeLayer(networkLayer);
      trains.clear();
    };
  }, [network, map, onStats]);

  return null;
}

export default BerlinUbahnLayer;
