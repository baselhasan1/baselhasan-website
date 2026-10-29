/**
 * The Berlin U-Bahn lines and their official BVG colours.
 *
 * Shared by the live map layer and the legend/filter so the two can never
 * drift apart. The same colours are baked into public/geo/berlin-ubahn.geojson
 * by scripts/fetch-ubahn.mjs, which reads them from OpenStreetMap.
 */
const UBAHN_LINES = [
  { ref: "U1", color: "#7DAD4C" },
  { ref: "U2", color: "#DA421E" },
  { ref: "U3", color: "#16683D" },
  { ref: "U4", color: "#F0D722" },
  { ref: "U5", color: "#7E5330" },
  { ref: "U6", color: "#8C6DAB" },
  { ref: "U7", color: "#528DBA" },
  { ref: "U8", color: "#224F86" },
  { ref: "U9", color: "#F3791D" },
];

export const UBAHN_REFS = UBAHN_LINES.map((line) => line.ref);

/** Yellow U4 needs dark text; every other line carries white. */
export function readableInk(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1c1917" : "#ffffff";
}

export default UBAHN_LINES;
