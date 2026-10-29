# PROJECT_CONTEXT.md

> **Next Claude session: read "Latest work and decisions" at the bottom first.** It
> records what was built most recently, the decisions the owner made, and what not to touch.

## Project Overview
This project is a **desktop-first personal portfolio website** for **Basel Hasan**.

The site is designed to present:
- Basel's personal journey from **Bahrain to Germany**
- interactive map-based storytelling
- resume / qualifications
- contact information
- website analytics

The project emphasizes a **clean, minimal, professional** visual style with subtle interactivity.

---

## Tech Stack
- **React**
- **Vite**
- **Vercel** for deployment
- **GitHub** for version control
- **Leaflet / react-leaflet** for map rendering
- **GeoJSON** for country/city outline data
- **Google Analytics 4** for analytics

---

## Core Design Principles
- **Desktop-first only**
  - Mobile is intentionally blocked with a message telling users to open on desktop
- **Minimal and polished UI**
  - clean layout
  - subtle shadows
  - light neutral palette
  - rounded borders
- **Interactive but not flashy**
  - transitions should feel smooth and modern
  - avoid clutter
- **Professional tone**
  - site should feel suitable for recruiters and professional contacts

---

## Current High-Level Structure

### Main App Shell
- `src/App.jsx`
  - controls overall layout
  - handles intro screen
  - handles sidebar navigation
  - handles active section state
  - loads map GeoJSON data
  - shows:
    - `JourneyView`
    - `ResumeView`
    - `ContactView`
    - `AnalyticsView`
    - `BugReportModal`

### Main Components
- `src/components/IntroScreen.jsx`
- `src/components/JourneyView.jsx`
- `src/components/ResumeView.jsx`
- `src/components/ContactView.jsx`
- `src/components/AnalyticsView.jsx`
- `src/components/BugReportModal.jsx`

### Data
- `src/data/journeyData.js`
  - contains map locations, city data, POIs, descriptions, links, etc.

### Public / Static Data
- `public/geo/` holds the trimmed GeoJSON the site loads (focus countries, Berlin outline,
  Berlin U-Bahn network). It is produced by `npm run prepare-geo` / `npm run fetch-ubahn`.
- `raw-geo/` holds the original large GeoJSON sources (moved out of `public/` so they
  are no longer shipped).
- favicon / logo assets

---

## Important UX / Behavior Rules

### 1. Intro Screen
- Site opens with intro screen first
- After intro ends, main site loads

### 2. Desktop Only
- Mobile users should see a simple message like:
  - “For a better experience, open the site on your computer :)”
- Do not convert current site into responsive mobile layout unless explicitly requested

### 3. Sidebar Navigation
- Sidebar buttons should look and behave like obvious clickable buttons
- Hover states are important
- Active section should be clearly indicated
- Germany has nested sub-tabs:
  - Frankfurt
  - Berlin
  - Technical University of Applied Sciences Wildau

### 4. Header Actions
Top-right currently includes:
- **Contact Me**
  - opens `mailto:baselkadhem@icloud.com`
  - no subject/body prefilled
- **Report Bug**
  - opens bug report modal

### 5. Section Transition Behavior
- Main content fades/slides in subtly when switching sections
- Avoid jarring animation

---

## JourneyView Rules
`JourneyView.jsx` is the most complex file and powers the interactive map.

### Journey Concept
The map is the core storytelling feature of the site.

Main journey locations:
- Bahrain
- Germany

Germany has subviews:
- overview
- Berlin
- Frankfurt
- Wildau

### Main Marker Labels
The large main markers currently hover as:
- **Manama**
- **Berlin**

### Outline Behavior
- Germany outline should display appropriately
- Berlin outline should also show on the Wildau tab
- Frankfurt outline should show on Frankfurt tab and overview when zoomed enough

### Wildau Behavior
Important:
- The **Technical University of Applied Sciences Wildau** icon should:
  - be hidden in Germany overview
  - be visible on the **Wildau tab**
- Wildau currently also supports a resizable overlay panel with:
  - iframe to `https://maps.th-wildau.de/`

### POI Behavior
POIs are categorized into:
- `restaurant`
- `education`
- `fun`

POIs use custom non-emoji icons:
- Restaurant → fork + knife
- Education → open book
- Fun → smiley

### POI Hover / Click Rules
- On hover: show icon card / title/category only
- On click: show fuller popup with description + link

### POI Zoom Rules
Current intended behavior:
- **Bahrain POIs**:
  - should appear only after zooming in enough
- **Berlin POIs**:
  - should show at all zoom levels when user is on Berlin tab
- **Frankfurt POIs**:
  - should show at all zoom levels when user is on Frankfurt tab
- **Wildau POIs**:
  - should show at all zoom levels when user is on Wildau tab, if any exist
- Germany overview can remain more restrictive

### Map Legend
- Map includes legend for POI categories
- Keep legend simple and visually clean

### General Map Constraints
- Do not casually break:
  - zoom behavior
  - fitBounds behavior
  - marker visibility logic
  - Germany sub-tab logic

---

## Current Content Notes

### Contact
Feedback received:
- Contact info felt too hidden
- Business card idea is nice, but there needed to be a faster contact method
- This was solved by adding **Contact Me** in the header

### Resume
- Resume section should remain clean and document-like
- A prior contact button inside resume was removed because it was not liked

### Analytics
- Analytics tab exists and uses GA4 integration
- Analytics should remain polished and readable

---

## Style Guidance for Future Edits
When changing UI:
- preserve current visual language
- prefer refinement over redesign
- keep rounded corners and subtle shadows
- avoid loud colors unless they already fit map meaning
- do not overcomplicate with too many buttons or dense controls

Good adjectives for future UI work:
- minimal
- balanced
- polished
- recruiter-friendly
- modern
- soft but clear

Avoid:
- clutter
- overly playful visuals
- excessive animation
- aggressive colors
- obvious “template” look

---

## Deployment / Hosting
- Repo is on GitHub
- Main branch is `main`
- Vercel deploys from GitHub
- Production domain is:
  - `baselhasan.com`
  - `www.baselhasan.com`

---

## Git Workflow
Typical commands used:

```bash
git add .
git commit -m "Your message"
git push
```

---

## Latest work and decisions (updated 2026-10-29)

### Ground rules for the next session
- **The Berlin U-Bahn map is the owner's prized work. Never rewrite, reset or "clean up"
  it without asking.** Files: `api/ubahn.js`, `src/components/BerlinUbahnLayer.jsx`,
  `src/components/UbahnPanel.jsx`, `src/ubahn.css`, `src/data/ubahnLines.js`,
  `src/data/ubahnStops.js`, `src/data/bvgFeed.js`, `src/data/vbbFeed.js`,
  `public/geo/berlin-ubahn.geojson`, `scripts/fetch-ubahn.mjs`,
  `scripts/bake-ubahn-stops.mjs`.
- Ask the owner before design or architecture decisions; present options with a
  recommendation. Don't commit or push unless asked.
- Desktop only. Initial JS budget is 150 KiB gzip (currently 122.4 KiB); check with
  `npm run verify` (lint + API tests + build + budget).
- The owner's main browser is **Firefox** (2560x1440 @ 144 Hz, RTX 5070). Test
  smoothness there. Firefox had hardware acceleration switched off, which caused the
  "15 fps" complaint; it is now on.

### Known test state
- `npm run test:e2e`: 3 of 4 tests in `tests/map.spec.js` were already failing before
  this work (map chapters, satellite fallback, BVG fallback — lines ~28, ~49, ~65).
  They are pre-existing, not caused by the motion/map changes. 1 passes.
- The chapter test now checks `aria-current="page"` on the Bahrain / Germany buttons
  (the "Chapter" text it used to look for was removed).

### Motion and page speed (`src/utils/motion.js`, `App.jsx`, `OverlayPanel.jsx`, `IntroScreen.jsx`, `index.css`)
- Inspired by landonorris.com (analysed with REA): hover prefetch, sliding nav pill,
  panel enter/exit via `usePresence`, staggered reveal, Lenis smooth scroll inside
  panels. No GSAP.
- The intro no longer blocks the site; panels are bundled directly (no lazy chunks).
- Chapter flights: 1.3 s for country hops, 0.8 s for city hops.

### Map zoom: "smooth and instant", then "guide my hand"
- **Decision: tune Leaflet, not rewrite to MapLibre GL.** (MapLibre was offered and
  declined — it would mean rewriting JourneyView and porting the U-Bahn layer.)
- `src/utils/smoothWheelZoom.js` replaces Leaflet's wheel zoom (`scrollWheelZoom={false}`
  on MapContainer, mounted by `SmoothWheelZoomHandler` in JourneyView). It moves the
  camera every frame, then settles on a half-level step. Tunables at the top of the file:

  | Constant | Value | Meaning |
  |---|---|---|
  | `PX_PER_LEVEL` | 200 | one wheel notch = half a zoom level (owner said full speed was too fast) |
  | `PINCH_PX_PER_LEVEL` | 120 | trackpad pinch |
  | `FOLLOW_MS` | 90 | zoom easing |
  | `SETTLE_MS` / `SETTLE_STEP` / `SETTLE_FORWARD_AT` | 110 / 0.5 / 0.3 | resting step logic |
  | `MAGNET_REACH` | 0.45 | pin magnet reach, share of the map's shorter side (~400 px) |
  | `MAGNET_STRENGTH` | 0.65 | share of the pin–pointer gap one gesture closes |
  | `MAGNET_FOLLOW_MS` | 160 | magnet easing |

- **Pin magnet** ("like someone guiding your hand", not a jolt): zooming in drifts the
  nearest interactive marker toward the pointer. Falloff `1 - (d/reach)^4`, zoom-in only.
  Place labels and U-Bahn stations are *not* magnets (adding stations was offered, not done).
- MapContainer uses `zoomSnap={0.5}`; chapter framing goes through `frameBounds()` in
  JourneyView, which floors to whole levels so flights land exactly as before.
- Satellite tiles are sharded over `server.arcgisonline.com` and
  `services.arcgisonline.com` (identical tiles), with preconnects in `index.html`.

### Removed UI
- The bottom-left "Chapter story" glass box (Chapter 1/2, title, paragraph) was removed
  at the owner's request, with its CSS. The city paragraphs still live in
  `src/data/journeyData.js` if they are ever wanted elsewhere.

### 144 Hz work (`src/utils/tileLayer.js`, `src/utils/leafletPatches.js`)
- `BufferedTileLayer`: O(n) `_pruneTiles`, fade loop that skips finished tiles, no forced
  reflow in `_updateLevels`, async image decode before fade-in, `_tileReady` guard,
  faster `_noTilesToLoad`.
- **Flight mode**: `ChangeMapView` fires `bhflightstart` before `flyTo` and `bhflightend`
  at 75 % of the flight (`SHARP_RESUME_AT`). During a flight the sharp layer
  (`flightMode="hold"`) loads nothing and fades out; the underlay drops to offset 1 and
  the floor to offset 3. Trade-off accepted for now: imagery is ~2x softer mid-flight;
  the landing is full sharpness. To revert, remove `flightMode="hold"` from the sharp
  layer in `JourneyView.jsx`.
- `leafletPatches.js` caches tooltip sizes so labels don't force a layout every frame.
- Measured in Firefox at 2560 wide: drag and wheel zoom at 144 Hz (worst frame ~19–26 ms);
  repeat flights mostly 14–35 ms worst frame; first cold trip can still hitch 50–70 ms
  while imagery downloads (network/decoding, not app code).
- Measuring tips: Firefox rAF timing hides compositor drops — use `MozAfterPaint`
  (pref `dom.send_after_paint_to_content`) and in-page synthetic drags; Playwright
  `mouse.move` every 16 ms caps at ~50 fps and is useless for this.
- Note: `PERFORMANCE.md` predates the smooth wheel zoom and flight mode; its tile
  strategy section is otherwise still accurate.

### Possible next steps (not promised)
- Further tuning of the zoom/magnet constants above.
- U-Bahn stations as magnets.
- A lighter glass blur for weaker browsers.
