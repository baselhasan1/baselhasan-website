import { Bounds, DomUtil, TileLayer, Util } from "leaflet";

// Leaflet keeps scaled parents five levels up but children only two levels
// down, so a fast three-level zoom-out drops every tile on screen and paints
// bare ground until the network catches up. Keeping children four levels
// deep means the sharp tiles you were just looking at shrink into place
// instead of vanishing.
//
// Parents are held less deeply than Leaflet's default. A tile five levels up
// is stretched thirty-two times and reads as a smear; three is the point where
// a held tile still looks like the place it depicts. Anything deeper than that
// falls through to the underlay, which tracks the camera and so is never worse.
const PARENT_DEPTH = 3;
const CHILD_DEPTH = 4;

// How quickly a layer held for a flight fades out, and back in for landing.
const FLIGHT_FADE_MS = 250;

/**
 * TileLayer that also requests a ring of tiles just outside the viewport.
 * Leaflet's `keepBuffer` only retains tiles it already has; nothing in the
 * stock layer ever loads ahead of a pan, which is why dragging exposes bare
 * ground before the new tiles arrive.
 */
export const BufferedTileLayer = TileLayer.extend({
  options: {
    edgeBufferTiles: 1,
    retainParentLevels: PARENT_DEPTH,
    retainChildLevels: CHILD_DEPTH,
    // Fetch this many levels below the camera instead of at it. A layer set
    // to 4 covers the view in a handful of tiles and stays a constant, modest
    // blur at every zoom, where a fixed `maxNativeZoom` gets worse the further
    // in you go: pinned at 7, it reached 2048x at street level.
    nativeZoomOffset: 0,
    // What to do while the camera flies between chapters (the map fires
    // `bhflightstart` / `bhflightend`). A flight crosses a zoom level every
    // tenth of a second or so, and loading a full screen of imagery at each
    // one, only to drop it a moment later, is what stalled flights.
    //   "hold"  load nothing, and fade out: tiles frozen at the old view would
    //           show as a sharper rectangle shrinking away, seams and all
    //   number  use this nativeZoomOffset instead for the flight
    flightMode: null,
  },

  getEvents() {
    const events = TileLayer.prototype.getEvents.call(this);
    if (this.options.flightMode != null) {
      events.bhflightstart = this._startFlight;
      events.bhflightend = this._endFlight;
    }
    return events;
  },

  _startFlight() {
    this._inFlight = true;
    if (this._isHeld()) this._fadeContainer(0);
  },

  _endFlight() {
    if (!this._inFlight) return;
    const wasHeld = this._isHeld();
    this._inFlight = false;
    this._resetView();
    if (wasHeld) this._fadeContainer(this.options.opacity);
  },

  _fadeContainer(opacity) {
    const container = this._container;
    if (!container) return;
    container.style.transition = `opacity ${FLIGHT_FADE_MS}ms ease`;
    container.style.opacity = String(opacity);
  },

  _isHeld() {
    return this._inFlight && this.options.flightMode === "hold";
  },

  _setView(center, zoom, noPrune, noUpdate) {
    if (this._isHeld()) {
      this._setZoomTransforms(center, zoom);
      return;
    }
    TileLayer.prototype._setView.call(this, center, zoom, noPrune, noUpdate);
  },

  _update(center) {
    if (this._isHeld()) return;
    TileLayer.prototype._update.call(this, center);
  },

  // Leaflet asks this for the level to fetch at, given the camera's level.
  //
  // The answer is derived from the map rather than from `zoom`, because
  // Leaflet feeds this function its own output: `_update` clamps, hands the
  // result to `_setView`, which clamps again. Subtracting the offset from the
  // argument would subtract it twice over and recurse until the stack blew.
  // Reading the camera makes the function idempotent, which is what Leaflet
  // assumes of it.
  _clampZoom(zoom) {
    const { flightMode } = this.options;
    const offset =
      this._inFlight && typeof flightMode === "number"
        ? flightMode
        : this.options.nativeZoomOffset;
    if (!offset || !this._map) {
      return TileLayer.prototype._clampZoom.call(this, zoom);
    }
    const coarse = Math.max(0, Math.round(this._map.getZoom()) - offset);
    return TileLayer.prototype._clampZoom.call(this, coarse);
  },

  _getTiledPixelBounds(center) {
    const bounds = TileLayer.prototype._getTiledPixelBounds.call(this, center);
    const buffer = this.options.edgeBufferTiles;
    if (!buffer) return bounds;
    const pad = this.getTileSize().multiplyBy(buffer);
    return new Bounds(bounds.min.subtract(pad), bounds.max.add(pad));
  },

  // Same outcome as Leaflet 1.9.4's pruning, with a deeper child search.
  //
  // Leaflet finds children by recursing down from every tile still loading:
  // four levels deep that is 340 lookups per tile, across three layers, and
  // it reruns as each tile fades in, which made flights stutter. Here every
  // tile instead walks up to see whether it sits under a tile that needs
  // covering: a handful of lookups per tile, once.
  _pruneTiles() {
    if (!this._map) return;

    const zoom = this._map.getZoom();
    if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
      this._removeAllTiles();
      return;
    }

    const tiles = this._tiles;
    for (const key in tiles) {
      const tile = tiles[key];
      tile.retain = tile.current;
    }

    const parents = this.options.retainParentLevels;
    const children = this.options.retainChildLevels;
    const needsChildren = new Set();

    for (const key in tiles) {
      const tile = tiles[key];
      if (tile.current && !tile.active) {
        const { x, y, z } = tile.coords;
        const parentFound =
          parents > 0 && this._retainParent(x, y, z, z - parents);
        if (!parentFound && children > 0) needsChildren.add(key);
      }
    }

    if (needsChildren.size) {
      for (const key in tiles) {
        const tile = tiles[key];
        if (!tile.active && !tile.loaded) continue;
        let { x, y } = tile.coords;
        const { z } = tile.coords;
        // An active tile in between already covers this one's area, so
        // Leaflet stops there; so does this.
        let covered = false;
        for (let depth = 1; depth <= children; depth++) {
          x = Math.floor(x / 2);
          y = Math.floor(y / 2);
          const ancestorKey = `${x}:${y}:${z - depth}`;
          if (needsChildren.has(ancestorKey)) {
            if (!covered) tile.retain = true;
            break;
          }
          if (tiles[ancestorKey]?.active) covered = true;
        }
      }
    }

    for (const key in tiles) {
      if (!tiles[key].retain) this._removeTile(key);
    }
  },

  // Decode each image before it starts fading in, and off the main thread.
  // Firefox otherwise decodes undecoded images synchronously while painting,
  // and a country flight brings in hundreds at once: that was the 100+ ms
  // freeze in flights there. (Chrome already decodes in the background.)
  createTile(coords, done) {
    const tile = TileLayer.prototype.createTile.call(this, coords, done);
    tile.decoding = "async";
    return tile;
  },

  _tileOnLoad(done, tile) {
    if (typeof tile.decode !== "function") {
      done(null, tile);
      return;
    }
    // A failed decode still shows what the browser has; never strand a tile.
    tile.decode().then(
      () => done(null, tile),
      () => done(null, tile)
    );
  },

  // Leaflet looks the tile up by position only. With decoding in between,
  // an image the layer has since dropped can finish after a newer tile took
  // its place; it must not mark that newer tile as loaded.
  _tileReady(coords, err, tile) {
    const current = this._tiles[this._tileCoordsToKey(coords)];
    if (tile && current && current.el !== tile) return;
    TileLayer.prototype._tileReady.call(this, coords, err, tile);
  },

  // Leaflet scans every tile from the start on each tile load to find one
  // still loading, which during a flight (hundreds of tiles, mostly loaded)
  // adds up to a scan per frame. Checking the one found last time first
  // answers almost every call immediately.
  _noTilesToLoad() {
    const last = this._tiles[this._bhLoadingKey];
    if (last && !last.loaded) return false;
    for (const key in this._tiles) {
      if (!this._tiles[key].loaded) {
        this._bhLoadingKey = key;
        return false;
      }
    }
    return true;
  },

  // Leaflet's fade-in, minus two costs. It rewrote the opacity of every tile
  // on screen every frame while any one was fading, and pruned every frame
  // too. Finished tiles are now skipped, and pruning runs only when a tile
  // has just become fully opaque, which is the only time it can change.
  _updateOpacity() {
    if (!this._map) return;

    if (this.options.opacity !== this._appliedOpacity) {
      DomUtil.setOpacity(this._container, this.options.opacity);
      this._appliedOpacity = this.options.opacity;
    }

    const now = Date.now();
    let fading = false;
    let settled = false;

    for (const key in this._tiles) {
      const tile = this._tiles[key];
      if (!tile.current || !tile.loaded || tile.faded) continue;

      const fade = Math.min(1, (now - tile.loaded) / 200);
      DomUtil.setOpacity(tile.el, fade);
      if (fade < 1) {
        fading = true;
      } else {
        tile.faded = true;
        if (!tile.active) this._onOpaqueTile(tile);
        tile.active = true;
        settled = true;
      }
    }

    if (settled && !this._noPrune) this._pruneTiles();

    if (fading) {
      Util.cancelAnimFrame(this._fadeFrame);
      this._fadeFrame = Util.requestAnimFrame(this._updateOpacity, this);
    }
  },

  // Leaflet reads offsetWidth on each new zoom level so its CSS zoom
  // transition starts cleanly. That forces a full layout, and a flight or a
  // smooth wheel zoom, which don't use that transition, crosses a new level
  // every few frames. Skip it unless a CSS zoom animation is running.
  _updateLevels() {
    const map = this._map;
    if (map._animatingZoom) return TileLayer.prototype._updateLevels.call(this);

    const zoom = this._tileZoom;
    const maxZoom = this.options.maxZoom;
    if (zoom === undefined) return undefined;

    for (const key in this._levels) {
      const z = Number(key);
      if (this._levels[z].el.children.length || z === zoom) {
        this._levels[z].el.style.zIndex = maxZoom - Math.abs(zoom - z);
        this._onUpdateLevel(z);
      } else {
        DomUtil.remove(this._levels[z].el);
        this._removeTilesAtZoom(z);
        this._onRemoveLevel(z);
        delete this._levels[z];
      }
    }

    let level = this._levels[zoom];
    if (!level) {
      level = this._levels[zoom] = {};
      level.el = DomUtil.create(
        "div",
        "leaflet-tile-container leaflet-zoom-animated",
        this._container
      );
      level.el.style.zIndex = maxZoom;
      level.origin = map.project(map.unproject(map.getPixelOrigin()), zoom).round();
      level.zoom = zoom;
      this._setZoomTransform(level, map.getCenter(), map.getZoom());
      this._onCreateLevel(level);
    }

    this._level = level;
    return level;
  },
});
