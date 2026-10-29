/**
 * Every place name the map shows, drawn by the site itself.
 *
 * The imagery provider's own label layer was a second set of raster tiles, so
 * it re-rendered at every zoom level: names faded out and back, changed size,
 * and appeared or vanished as the provider's own rules saw fit. These are
 * fixed instead. A label is defined once, sits at one size on screen whatever
 * the zoom, and simply switches on at the level it belongs to.
 *
 * `minZoom` is the level a name appears at, and it stays from there on unless
 * a `maxZoom` retires it. Chapter anchors (Berlin, Frankfurt, TH Wildau) are
 * not listed: the map already labels those with their own markers.
 */

export const COUNTRY = "country";
export const CITY = "city";
export const DISTRICT = "district";

export const PLACE_LABELS = [
  // Overview scale, where the countries are the only useful names.
  { text: "Bahrain", coordinates: [26.03, 50.55], tier: COUNTRY, minZoom: 5, maxZoom: 7 },
  { text: "Germany", coordinates: [51.1, 10.4], tier: COUNTRY, minZoom: 5, maxZoom: 7 },

  // Bahrain. Manama is missing on purpose: it is the chapter anchor, and the
  // map already labels it through that marker.
  { text: "Muharraq", coordinates: [26.2572, 50.6119], tier: CITY, minZoom: 9 },
  { text: "Riffa", coordinates: [26.13, 50.555], tier: CITY, minZoom: 9 },
  { text: "Isa Town", coordinates: [26.1736, 50.5478], tier: DISTRICT, minZoom: 11 },
  { text: "Hamad Town", coordinates: [26.115, 50.507], tier: DISTRICT, minZoom: 11 },
  { text: "Sitra", coordinates: [26.154, 50.621], tier: DISTRICT, minZoom: 11 },
  { text: "Budaiya", coordinates: [26.218, 50.457], tier: DISTRICT, minZoom: 12 },
  { text: "Hidd", coordinates: [26.242, 50.655], tier: DISTRICT, minZoom: 12 },

  // Berlin and its neighbours
  { text: "Potsdam", coordinates: [52.399, 13.058], tier: CITY, minZoom: 10 },
  { text: "Spandau", coordinates: [52.535, 13.2], tier: DISTRICT, minZoom: 11 },
  { text: "Köpenick", coordinates: [52.445, 13.575], tier: DISTRICT, minZoom: 11 },
  { text: "Charlottenburg", coordinates: [52.516, 13.304], tier: DISTRICT, minZoom: 12 },
  { text: "Prenzlauer Berg", coordinates: [52.54, 13.424], tier: DISTRICT, minZoom: 12 },
  { text: "Friedrichshain", coordinates: [52.515, 13.454], tier: DISTRICT, minZoom: 12 },
  { text: "Kreuzberg", coordinates: [52.498, 13.403], tier: DISTRICT, minZoom: 12 },
  { text: "Neukölln", coordinates: [52.481, 13.435], tier: DISTRICT, minZoom: 12 },
  { text: "Schöneberg", coordinates: [52.482, 13.355], tier: DISTRICT, minZoom: 12 },
  { text: "Wedding", coordinates: [52.55, 13.34], tier: DISTRICT, minZoom: 12 },
  { text: "Tempelhof", coordinates: [52.467, 13.385], tier: DISTRICT, minZoom: 12 },
  { text: "Steglitz", coordinates: [52.456, 13.332], tier: DISTRICT, minZoom: 12 },
  { text: "Pankow", coordinates: [52.569, 13.402], tier: DISTRICT, minZoom: 12 },
  { text: "Lichtenberg", coordinates: [52.515, 13.498], tier: DISTRICT, minZoom: 12 },
  // The campus marker names the university, not the town, and it only does so
  // on hover, so the TH Wildau chapter needs this to have a name of its own.
  // Offset south east of the campus marker so the badge does not sit on it.
  { text: "Wildau", coordinates: [52.309, 13.657], tier: CITY, minZoom: 10 },
  { text: "Moabit", coordinates: [52.53, 13.34], tier: DISTRICT, minZoom: 13 },
  { text: "Wilmersdorf", coordinates: [52.483, 13.319], tier: DISTRICT, minZoom: 13 },
  { text: "Treptow", coordinates: [52.493, 13.46], tier: DISTRICT, minZoom: 13 },

  // Frankfurt and its neighbours
  { text: "Offenbach am Main", coordinates: [50.1, 8.766], tier: CITY, minZoom: 10 },
  { text: "Bad Homburg", coordinates: [50.227, 8.618], tier: CITY, minZoom: 11 },
  { text: "Sachsenhausen", coordinates: [50.098, 8.685], tier: DISTRICT, minZoom: 12 },
  { text: "Bockenheim", coordinates: [50.123, 8.64], tier: DISTRICT, minZoom: 12 },
  { text: "Westend", coordinates: [50.12, 8.662], tier: DISTRICT, minZoom: 13 },
  { text: "Nordend", coordinates: [50.129, 8.689], tier: DISTRICT, minZoom: 12 },
  { text: "Bornheim", coordinates: [50.13, 8.71], tier: DISTRICT, minZoom: 12 },
  { text: "Ostend", coordinates: [50.115, 8.706], tier: DISTRICT, minZoom: 13 },
  { text: "Gallus", coordinates: [50.105, 8.64], tier: DISTRICT, minZoom: 13 },
  { text: "Niederrad", coordinates: [50.085, 8.632], tier: DISTRICT, minZoom: 12 },
  { text: "Höchst", coordinates: [50.099, 8.545], tier: DISTRICT, minZoom: 12 },
];
