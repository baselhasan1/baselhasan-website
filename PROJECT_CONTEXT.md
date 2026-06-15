# PROJECT_CONTEXT.md

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
Likely includes:
- `public/world.geojson`
- `public/countries-detailed.geojson`
- `public/berlin_bezirke.geojson`
- `public/frankfurt.geojson`
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