import { useMemo } from "react";
import { Marker } from "react-leaflet";
import { divIcon } from "leaflet";
import { PLACE_LABELS } from "../data/placeLabels.js";

/**
 * The map's place names, set in the site's own type.
 *
 * Each name is drawn at a fixed size on screen and switches on at the zoom it
 * belongs to, so zooming reveals more names rather than redrawing the ones
 * already there. Nothing here reacts to zoom except whether it is rendered.
 */
export default function MapPlaceLabels({ zoom }) {
  const icons = useMemo(() => {
    const cache = new Map();
    for (const label of PLACE_LABELS) {
      cache.set(
        label.text,
        divIcon({
          className: `bh-place-label bh-place-label--${label.tier}`,
          html: `<span>${label.text}</span>`,
          iconSize: [0, 0],
        })
      );
    }
    return cache;
  }, []);

  const visible = useMemo(() => {
    const level = Math.round(zoom);
    return PLACE_LABELS.filter(
      (label) =>
        level >= label.minZoom &&
        (label.maxZoom === undefined || level <= label.maxZoom)
    );
  }, [zoom]);

  return visible.map((label) => (
    <Marker
      key={label.text}
      position={label.coordinates}
      icon={icons.get(label.text)}
      interactive={false}
      keyboard={false}
      zIndexOffset={-500}
    />
  ));
}
