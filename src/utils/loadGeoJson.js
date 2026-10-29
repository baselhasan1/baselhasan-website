import { endMeasure, startMeasure } from "./performance.js";

const BASE_URL = import.meta.env.BASE_URL || "/";

export function assetUrl(path) {
  return `${BASE_URL}${path.replace(/^\/+/, "")}`;
}

export async function loadGeoJson(path, { signal } = {}) {
  const metric = `geojson:${path}`;
  startMeasure(metric);
  const response = await fetch(assetUrl(path), { signal });
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json") && !contentType.includes("geo+json")) {
    throw new Error(`${path} returned ${contentType || "an unknown content type"}`);
  }

  const data = await response.json();
  if (!data || !["Feature", "FeatureCollection"].includes(data.type)) {
    throw new Error(`${path} is not valid GeoJSON`);
  }

  endMeasure(metric);
  return data;
}
