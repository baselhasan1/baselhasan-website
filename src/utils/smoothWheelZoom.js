import { DomEvent, Handler, Marker, Util } from "leaflet";

// One mouse-wheel notch (100 px in Chrome and Edge) is half a zoom level.
const PX_PER_LEVEL = 200;
// Trackpad pinches arrive as ctrl+wheel with much smaller deltas.
const PINCH_PX_PER_LEVEL = 120;
// How quickly the camera catches up with the wheel. The camera covers about
// 95% of the remaining distance in three times this, so ~270 ms here.
const FOLLOW_MS = 90;
// How long after the last wheel event the gesture counts as finished and the
// zoom settles on a resting step.
const SETTLE_MS = 110;
// Resting zoom steps. Half levels stay sharp: at x.5 Leaflet shows the next
// level's imagery scaled down, never the previous one stretched.
const SETTLE_STEP = 0.5;
// Past this fraction of a step in the direction of travel, settle forward
// rather than back, so a small deliberate nudge isn't undone.
const SETTLE_FORWARD_AT = 0.3;

// Zooming in near a pin drifts the pin toward the pointer.
// Reach, as a share of the map's shorter side (~400 px on a 900 px tall
// window). Pins further than this from the pointer don't pull.
const MAGNET_REACH = 0.45;
// Share of the on-screen gap between pin and pointer that one gesture closes,
// for a pin close to the pointer; it falls off with distance. Below 1, so it
// guides rather than snaps: a second scroll closes most of what is left.
const MAGNET_STRENGTH = 0.65;
// The drift eases in more slowly than the zoom itself, so it reads as being
// led there rather than jumped.
const MAGNET_FOLLOW_MS = 160;

/**
 * Wheel and trackpad zoom that follows the input every frame, instead of
 * Leaflet's stock handler, which waits out a debounce, plays a fixed 250 ms
 * animation per step and drops any wheel input that arrives mid-animation.
 *
 * The camera moves the way Leaflet's own pinch zoom moves it (`_move` each
 * frame, then one `_moveEnd`), so tile layers, renderers and markers follow
 * through a path they already support. When the wheel stops, the zoom
 * settles on a resting step so the satellite imagery is never left stretched.
 */
export const SmoothWheelZoom = Handler.extend({
  addHooks() {
    DomEvent.on(this._map.getContainer(), "wheel", this._onWheel, this);
    this._map.on("dragstart", this._finish, this);
  },

  removeHooks() {
    DomEvent.off(this._map.getContainer(), "wheel", this._onWheel, this);
    this._map.off("dragstart", this._finish, this);
    this._finish();
  },

  _onWheel(event) {
    DomEvent.stop(event);
    const map = this._map;

    const unit = event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 800 : 1;
    const perLevel = event.ctrlKey ? PINCH_PX_PER_LEVEL : PX_PER_LEVEL;
    const levels = (-event.deltaY * unit) / perLevel;
    if (!levels) return;

    if (!this._active) {
      // Cancels a fly-to or pan in progress, as the stock handler does.
      map._stop();
      this._active = true;
      this._zoom = map.getZoom();
      this._target = this._zoom;
      this._startZoom = this._zoom;
      this._anchorPoint = null;
      this._lastFrame = performance.now();
      map.fire("zoomstart", { smooth: true });
      map.fire("movestart");
      this._frame = Util.requestAnimFrame(this._step, this);
    }

    // Re-anchor only when the pointer has actually moved, so the magnet's
    // pull is measured once per place rather than compounding on every
    // event of a long trackpad gesture.
    const pointer = map.mouseEventToContainerPoint(event);
    if (!this._anchorPoint || pointer.distanceTo(this._anchorPoint) > 2) {
      this._anchorPoint = pointer;
      this._anchorLatLng = map.containerPointToLatLng(pointer);
      this._anchorZoom = this._zoom;
      this._magnet = this._findMagnet(pointer);
      this._pull = 0;
    }

    this._target = this._clamp(this._target + levels);
    this._settled = false;
    clearTimeout(this._settleTimer);
    this._settleTimer = setTimeout(() => this._settle(), SETTLE_MS);
  },

  _clamp(zoom) {
    return Math.min(this._map.getMaxZoom(), Math.max(this._map.getMinZoom(), zoom));
  },

  // The nearest interactive marker within reach of the pointer, and how
  // strongly it pulls. Place-name labels are not interactive, so they don't.
  _findMagnet(pointer) {
    const map = this._map;
    const size = map.getSize();
    const radius = MAGNET_REACH * Math.min(size.x, size.y);
    let best = null;
    map.eachLayer((layer) => {
      if (!(layer instanceof Marker) || layer.options.interactive === false) return;
      const latLng = layer.getLatLng();
      const distance = map.latLngToContainerPoint(latLng).distanceTo(pointer);
      if (distance < radius && (!best || distance < best.distance)) {
        best = { latLng, distance };
      }
    });
    if (!best) return null;
    // Close to full strength over most of the reach, fading only near its
    // edge, so a pin some way off still clearly pulls.
    const falloff = 1 - (best.distance / radius) ** 4;
    return { latLng: best.latLng, strength: MAGNET_STRENGTH * falloff };
  },

  _settle() {
    const steps = this._target / SETTLE_STEP;
    const direction = Math.sign(this._target - this._startZoom);
    const whole =
      direction > 0
        ? Math.floor(steps + 1 - SETTLE_FORWARD_AT)
        : direction < 0
          ? Math.ceil(steps - 1 + SETTLE_FORWARD_AT)
          : Math.round(steps);
    this._target = this._clamp(whole * SETTLE_STEP);
    this._settled = true;
  },

  _step(now) {
    if (!this._active) return;
    const map = this._map;

    const dt = Math.min(now - this._lastFrame, 64);
    this._lastFrame = now;

    const remaining = this._target - this._zoom;
    this._zoom += remaining * (1 - Math.exp(-dt / FOLLOW_MS));

    // Only zooming in is guided; zooming out lets go. Zooming in spreads the
    // map apart, so the pull grows with the zoom to still bring the pin
    // `strength` of the way toward the pointer on screen.
    let pullTarget = 0;
    if (this._magnet && this._target > this._startZoom) {
      const spread = 2 ** Math.max(0, this._zoom - this._anchorZoom);
      pullTarget = Math.max(0, 1 - (1 - this._magnet.strength) / spread);
    }
    this._pull += (pullTarget - this._pull) * (1 - Math.exp(-dt / MAGNET_FOLLOW_MS));

    const done =
      this._settled &&
      Math.abs(this._target - this._zoom) < 0.001 &&
      Math.abs(pullTarget - this._pull) < 0.002;
    if (done) {
      this._zoom = this._target;
      this._pull = pullTarget;
    }

    // The point held under the pointer: where the pointer was, drawn part of
    // the way toward the magnet.
    let anchor = this._anchorLatLng;
    if (this._magnet && this._pull > 0) {
      const from = map.project(anchor, this._zoom);
      const to = map.project(this._magnet.latLng, this._zoom);
      anchor = map.unproject(from.add(to.subtract(from).multiplyBy(this._pull)), this._zoom);
    }

    const half = map.getSize().divideBy(2);
    const offset = this._anchorPoint.subtract(half);
    const center = map.unproject(map.project(anchor, this._zoom).subtract(offset), this._zoom);

    // Mid-gesture, `pinch` tells tile layers not to prune; the final frame
    // goes without it so they tidy up, as Leaflet's own pinch zoom does.
    map._move(center, this._zoom, done ? undefined : { pinch: true, round: false });

    if (done) {
      this._end();
    } else {
      this._frame = Util.requestAnimFrame(this._step, this);
    }
  },

  // Ends the gesture right away on the nearest resting step. Used when a
  // drag takes over mid-zoom.
  _finish() {
    if (!this._active) return;
    this._zoom = this._clamp(Math.round(this._zoom / SETTLE_STEP) * SETTLE_STEP);
    this._map._move(this._map.getCenter(), this._zoom);
    this._end();
  },

  _end() {
    Util.cancelAnimFrame(this._frame);
    clearTimeout(this._settleTimer);
    this._active = false;
    this._settled = false;
    // Fires zoomend and moveend: tiles prune and load, renderers redraw,
    // and max bounds pull the view back if the zoom took it outside.
    this._map._moveEnd(true);
  },
});
