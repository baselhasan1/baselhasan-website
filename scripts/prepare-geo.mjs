/**
 * Build-time GeoJSON preprocessing.
 *
 * Turns the raw map sources in raw-geo/ into the small static files the site
 * actually needs, so the browser never downloads megabytes of geometry and
 * never has to run turf to merge district polygons.
 *
 * Inputs  (raw-geo/):    countries-detailed.geojson, berlin_bezirke.geojson,
 *                        frankfurt.geojson
 * Outputs (public/geo/): focus-countries.geojson, berlin-outline.geojson,
 *                        frankfurt-outline.geojson
 *
 * Run with: npm run prepare-geo
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = join(root, "raw-geo");
const outDir = join(root, "public", "geo");

mkdirSync(outDir, { recursive: true });

function readRaw(name) {
  // Prefer raw-geo/, fall back to public/ so the script also works on a tree
  // where the sources have not been moved yet.
  const rawPath = join(rawDir, name);
  const path = existsSync(rawPath) ? rawPath : join(root, "public", name);
  return JSON.parse(readFileSync(path, "utf8"));
}

function roundCoords(coords, precision) {
  const factor = 10 ** precision;
  if (typeof coords[0] === "number") {
    return coords.map((value) => Math.round(value * factor) / factor);
  }
  return coords.map((child) => roundCoords(child, precision));
}

function quantize(geojson, precision) {
  const clone = JSON.parse(JSON.stringify(geojson));
  const features = clone.features || [clone];

  features.forEach((feature) => {
    if (feature.geometry?.coordinates) {
      feature.geometry.coordinates = roundCoords(
        feature.geometry.coordinates,
        precision
      );
    }
  });

  return clone;
}

function write(name, data) {
  const json = JSON.stringify(data);
  writeFileSync(join(outDir, name), json);
  console.log(
    `  public/geo/${name.padEnd(26)} ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB`
  );
}

console.log("Preparing GeoJSON assets...");

// The world basemap that used to live here is gone: the map is satellite-only,
// so the abstract vector land was never visible and only cost download and
// re-projection time. `git log` has it if it's ever needed again.

// --- 1. Focus countries ---------------------------------------------------
// Pull just Bahrain + Germany out of the 14 MB detailed country file.
const detailed = readRaw("countries-detailed.geojson");
const focusFeatures = detailed.features
  .filter((feature) => {
    const props = feature.properties || {};
    const code = props.ISO_A3 || props.ISO3166_1_Alpha_3 || props.ADM0_A3;
    const name = props.name || props.NAME || props.ADMIN;
    return (
      code === "BHR" || code === "DEU" || name === "Bahrain" || name === "Germany"
    );
  })
  .map((feature) => {
    const props = feature.properties || {};
    const simplified = turf.simplify(feature, {
      tolerance: 0.005,
      highQuality: true,
    });
    simplified.properties = {
      iso: props.ISO_A3 || props.ISO3166_1_Alpha_3 || props.ADM0_A3 || null,
      name: props.name || props.NAME || props.ADMIN || null,
    };
    return simplified;
  });

if (focusFeatures.length !== 2) {
  throw new Error(
    `Expected Bahrain + Germany, found ${focusFeatures.length} features. ` +
      "Check the property names in countries-detailed.geojson."
  );
}

write(
  "focus-countries.geojson",
  quantize({ type: "FeatureCollection", features: focusFeatures }, 4)
);

// --- 2. City outlines -----------------------------------------------------
// Union the districts once here instead of on every page load.
function mergeToOuterBorder(collection) {
  let merged = collection.features[0];

  for (let i = 1; i < collection.features.length; i += 1) {
    const unioned = turf.union(
      turf.featureCollection([merged, collection.features[i]])
    );
    if (unioned) merged = unioned;
  }

  merged.properties = {};
  return merged;
}

write(
  "berlin-outline.geojson",
  quantize(
    turf.simplify(mergeToOuterBorder(readRaw("berlin_bezirke.geojson")), {
      tolerance: 0.0008,
      highQuality: true,
    }),
    4
  )
);

write(
  "frankfurt-outline.geojson",
  quantize(
    turf.simplify(mergeToOuterBorder(readRaw("frankfurt.geojson")), {
      tolerance: 0.0008,
      highQuality: true,
    }),
    4
  )
);

console.log("Done.");
