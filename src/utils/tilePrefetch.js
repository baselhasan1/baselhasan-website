import { Browser, Util, latLngBounds } from "leaflet";

/**
 * Warms the browser's HTTP cache with tiles the map is likely to need next,
 * so that when Leaflet asks for them they are already on disk.
 *
 * URLs are built exactly the way Leaflet builds them (same template, same
 * subdomain rotation, same retina suffix); anything else would never hit.
 */

const TILE_SIZE = 256;
const MAX_INFLIGHT = 4;
const MAX_QUEUE = 240;
const SEEN_TTL_MS = 5 * 60 * 1000;
const SEEN_CAP = 4000;

let sources = [];
const queue = [];
const inflight = new Set();
const seen = new Map();

/** @param {{url: string, subdomains?: string, minZoom?: number, maxZoom: number}[]} next */
export function setTileSources(next) {
  sources = next || [];
  cancelPrefetch();
}

/** Drops everything not yet requested. In-flight images are left to finish. */
export function cancelPrefetch() {
  queue.length = 0;
}

function tileUrl(source, x, y, z) {
  const n = 2 ** z;
  if (y < 0 || y >= n) return null;
  const wx = ((x % n) + n) % n;
  const subdomains = source.subdomains || "abc";
  return Util.template(source.url, {
    r: Browser.retina ? "@2x" : "",
    s: subdomains[Math.abs(wx + y) % subdomains.length],
    x: wx,
    y,
    z,
  });
}

function pump() {
  while (inflight.size < MAX_INFLIGHT && queue.length) {
    const url = queue.shift();
    const last = seen.get(url);
    if (last && Date.now() - last < SEEN_TTL_MS) continue;
    if (seen.size >= SEEN_CAP) seen.clear();
    seen.set(url, Date.now());

    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    const done = () => {
      inflight.delete(image);
      image.onload = null;
      image.onerror = null;
      pump();
    };
    image.onload = done;
    image.onerror = done;
    inflight.add(image);
    image.src = url;
  }
}

function enqueue(urls, front) {
  if (front) queue.unshift(...urls);
  else queue.push(...urls);
  if (queue.length > MAX_QUEUE) queue.length = MAX_QUEUE;
  pump();
}

/**
 * Queues every registered source's tiles covering `bounds` at integer `zoom`,
 * centre first. Returns the number of URLs queued.
 */
export function prefetchBounds(map, bounds, zoom, front = false) {
  if (!sources.length || !map || !bounds) return 0;
  if (typeof document !== "undefined" && document.hidden) return 0;

  const z = Math.round(zoom);
  const active = sources.filter(
    (source) => z <= source.maxZoom && z >= (source.minZoom ?? 0)
  );
  if (!active.length) return 0;

  const area = latLngBounds(bounds);
  const min = map.project(area.getNorthWest(), z).divideBy(TILE_SIZE).floor();
  const max = map
    .project(area.getSouthEast(), z)
    .divideBy(TILE_SIZE)
    .ceil()
    .subtract([1, 1]);
  if (!Number.isFinite(min.x) || !Number.isFinite(max.x)) return 0;

  const cx = (min.x + max.x) / 2;
  const cy = (min.y + max.y) / 2;
  const coords = [];
  for (let y = min.y; y <= max.y; y++) {
    for (let x = min.x; x <= max.x; x++) coords.push([x, y]);
  }
  coords.sort(
    (a, b) =>
      (a[0] - cx) ** 2 + (a[1] - cy) ** 2 - ((b[0] - cx) ** 2 + (b[1] - cy) ** 2)
  );

  const urls = [];
  for (const [x, y] of coords) {
    for (const source of active) {
      const url = tileUrl(source, x, y, z);
      if (url) urls.push(url);
    }
  }
  enqueue(urls, front);
  return urls.length;
}

/**
 * The viewport the map will show once it sits at `center` and `zoom`,
 * padded a little so slight overshoot is still covered.
 */
export function viewportAt(map, center, zoom, padRatio = 0.15) {
  const half = map.getSize().divideBy(2);
  const pixelCenter = map.project(center, zoom);
  return latLngBounds(
    map.unproject(pixelCenter.subtract(half), zoom),
    map.unproject(pixelCenter.add(half), zoom)
  ).pad(padRatio);
}
