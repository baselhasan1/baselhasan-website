import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { BufferedTileLayer } from "../utils/tileLayer.js";

/**
 * react-leaflet style wrapper around BufferedTileLayer. Options are read once
 * when the layer is created; a url change swaps the whole layer, which only
 * happens when the imagery provider falls back.
 */
export default function MapTileLayer({ url, eventHandlers, ...options }) {
  const map = useMap();
  const layerRef = useRef(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const layer = new BufferedTileLayer(url, optionsRef.current);
    layerRef.current = layer;
    layer.addTo(map);
    return () => {
      layer.remove();
      if (layerRef.current === layer) layerRef.current = null;
    };
  }, [map, url]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !eventHandlers) return undefined;
    layer.on(eventHandlers);
    return () => {
      layer.off(eventHandlers);
    };
  }, [eventHandlers, url, map]);

  return null;
}
