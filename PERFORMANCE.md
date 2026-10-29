# Performance budgets

- Initial JavaScript: at most 150 KiB gzip.
- Live U-Bahn refresh: one aggregated browser request, never overlapping, every 20 seconds.
- Long tasks: below 100 ms during ordinary map interaction.
- Map interactive target: within 2 seconds on a warm Fast 3G visit after the intro.
- Tile smoothness: no bare ground visible during zoom, pan or chapter flights. The map
  trades bandwidth for this deliberately (see below).

## Tile loading strategy

The goal is Google-Maps-style continuity: something is always painted, and new detail
fades in over it rather than popping in as squares.

- Zoom and fade animations are on. The previous level stays on screen, scaled, while
  the next one loads and cross-fades (Leaflet `zoomAnimation` / `fadeAnimation`).
- `zoomAnimationThreshold` is 12, not Leaflet's default 4. Past its threshold Leaflet
  stops animating and hard resets the view, which tears down every tile grid at once
  and leaves bare ground until the reload finishes. A fast wheel flick clears four
  levels easily, so the default made the worst gesture the worst-looking one.
- Imagery keeps scaled parents up to 3 levels and children up to 4 levels deep
  (`src/utils/tileLayer.js`), so a wheel flick keeps the tiles you were looking at.
  Parents are held less deeply than Leaflet's default of 5: a tile five levels up is
  stretched 32 times and reads as a smear, and the tracking underlay below covers that
  case better.
- Every tile layer requests one tile beyond each viewport edge and retains three
  (`edgeBufferTiles` / `keepBuffer`), and loads while the camera is moving
  (`updateWhenIdle: false`, 120 ms interval) so a pan lands on imagery.
- Three imagery layers stack, so nothing is ever bare and the fallback is as sharp as
  it can be. The **sharp** layer draws at the camera's own level. The **tracking**
  underlay draws four levels below it (`nativeZoomOffset`), a constant 16× blur at any
  zoom, and is what you see for the fraction of a second before the sharp tiles land.
  The **floor** is pinned at `maxNativeZoom` 7: a few dozen tiles fetched once and then
  always available, however far the camera jumps. It is the only thing standing between
  a huge jump and ground colour, and at street level it is a 4096× stretch, which is why
  the tracking layer exists above it. Before that layer was added the floor was the only
  fallback, so every zoom transition showed it.
- After the camera is idle for 180 ms, `src/components/MapTilePrefetch.jsx` warms the
  HTTP cache with the centre of the view one level in and the surroundings one and two
  levels out (at most 240 queued, 4 in flight, low fetch priority, dropped on the next
  move). Chapter flights warm the arc apex (zoom 3–4) and the destination viewport
  while the plane is in the air.

Expect roughly 2–3× the tile requests of a bare Leaflet setup on a fresh area; repeat
views are served from cache. The tracking underlay adds about 30 tiles per zoom level
reached, and those levels are usually in cache already because the camera passed through
them. If bandwidth ever matters more than smoothness, lower `TILE_EDGE_BUFFER` /
`TILE_KEEP_BUFFER` in `JourneyView.jsx` and shrink the prefetch radii in
`MapTilePrefetch.jsx` first.

The ceiling is zoom 19. Esri serves real imagery there over all three cities, verified
tile by tile; it upsamples past that. The Gulf around Bahrain has no imagery below zoom
18 either, so panning off the island at close range shows Esri's grey "no data" tiles —
that predates the ceiling change and is a gap in the provider's coverage, not a bug.

Softness during a zoom is inherent to raster imagery: the level you were on is scaled
while the next downloads. What is avoidable is *how* soft the stand-in is, which is what
the three-layer stack controls. The remaining limit is resolution: Esri serves 256 px
tiles with no retina variant, so on a high-density display every tile is upscaled
permanently. Fixing that means a provider that serves `@2x` tiles (Mapbox, MapTiler),
which needs an API key.

## Place names

The map draws its own. Esri's place-name layer was a second set of raster tiles, which
meant the text re-rendered at every zoom level: names faded out and back, changed size,
and appeared or vanished on the provider's rules rather than ours. It is gone.

`src/data/placeLabels.js` holds every name, and `MapPlaceLabels` renders each as a
zero-size marker so the text sits at one size on screen at any zoom. A label carries the
`minZoom` it appears at and, for the two country names, a `maxZoom` that retires it.
Zooming changes only which names are on the map, never how any of them is drawn. The
same rule governs the U-Bahn station names, which are fixed at 11 px and gated at zoom
14 for interchanges and 15 for the rest.

Chapter anchors (Manama, Berlin, Frankfurt, TH Wildau) are deliberately absent from the
list: their markers already label them. Note that a city moves between the hero and
plain-city marker branches as chapters change, so the hero branch uses its own React key
— react-leaflet binds a tooltip's `permanent` flag once, at creation, and a reused
element would keep the hover-only tooltip.

Dropping the layer also removed a third of all tile requests and roughly a fifth of tile
bytes; label tiles ran 2.8 KB at street zoom to 12.6 KB at overview zoom, against
19–26 KB for imagery.

Run `npm run verify` before deployment and `npm run test:e2e` for map regressions.
Use Chrome Performance with Slow 4G and 6× CPU throttling for release checks; synthetic
timing varies enough that the two-second interaction target is intentionally a manual gate.
