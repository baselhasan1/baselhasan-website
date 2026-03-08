const JOURNEY_DATA = {
  bahrain: {
    buttonLabel: "Chapter 1 — Bahrain",
    title: "Bahrain",
    text: "This is where I graduated high school and built the foundation for my next step.",
    coordinates: [26.145, 50.534],
    bounds: [
      [24.7, 49.6],
      [27.5, 51.8],
    ],
    exploreBounds: [
      [24.2, 49.0],
      [28.0, 52.2],
    ],
    cities: [{ name: "Buri", coordinates: [26.145, 50.534] }],
    countryCodes: ["BHR"],
    countryNames: ["Bahrain"],
  },
  germany: {
    buttonLabel: "Chapter 2 — Germany",
    title: "Germany",
    text: "This is where I moved to continue my journey and grow in business informatics.",
    coordinates: [52.52, 13.405],
    bounds: [
      [52.15, 13.2],
      [52.65, 13.9],
    ],
    exploreBounds: [
      [52.0, 13.0],
      [52.75, 14.0],
    ],
    cities: [
      { name: "Berlin", coordinates: [52.52, 13.405] },
      { name: "TH Wildau", coordinates: [52.3194, 13.6325] },
    ],
    countryCodes: ["DEU"],
    countryNames: ["Germany"],
  },
};

export default JOURNEY_DATA;