import { useEffect } from "react";
import { useMap } from "react-leaflet";
import {
  cancelPrefetch,
  prefetchBounds,
  setTileSources,
} from "../utils/tilePrefetch.js";

// How long the camera has to sit still before we start speculating.
const IDLE_MS = 180;

/**
 * Once the camera settles, warms the cache with the tiles a wheel zoom in
 * either direction would need next: the middle of the view one level in, and
 * the surrounding area one and two levels out. Same-zoom neighbours are
 * covered by the tile layer's own edge buffer. Anything still queued is
 * dropped the moment the camera moves again.
 */
export default function MapTilePrefetch({ sources, minZoom, maxZoom }) {
  const map = useMap();

  useEffect(() => {
    setTileSources(sources);
    return () => setTileSources([]);
  }, [sources]);

  useEffect(() => {
    let timer = null;

    const warm = () => {
      timer = null;
      const zoom = Math.round(map.getZoom());
      const view = map.getBounds();
      if (zoom + 1 <= maxZoom) prefetchBounds(map, view.pad(-0.2), zoom + 1);
      if (zoom - 1 >= minZoom) prefetchBounds(map, view.pad(0.75), zoom - 1);
      if (zoom - 2 >= minZoom) prefetchBounds(map, view.pad(1.5), zoom - 2);
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(warm, IDLE_MS);
    };

    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      cancelPrefetch();
    };

    map.on("moveend", schedule);
    map.on("movestart zoomstart", cancel);
    schedule();

    return () => {
      cancel();
      map.off("moveend", schedule);
      map.off("movestart zoomstart", cancel);
    };
  }, [map, minZoom, maxZoom]);

  return null;
}
