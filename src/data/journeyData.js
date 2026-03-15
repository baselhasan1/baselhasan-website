const JOURNEY_DATA = {
  bahrain: {
    buttonLabel: "Chapter 1 — Bahrain",
    title: "Bahrain",
    text: "My home country is a peaceful little island with a lot to offer. It is where I graduated from Modern Knowledge Schools in 2020 with an American Diploma.",
    coordinates: [26.145, 50.534],
    bounds: [
      [24.7, 49.6],
      [27.5, 51.8],
    ],
    exploreBounds: [
      [24.2, 49.0],
      [28.0, 52.2],
    ],
    cities: [
      { name: "Buri", coordinates: [26.145, 50.534] },
      { name: "Modern Knowledge Schools", coordinates: [26.206, 50.601] },
      {
        name: "Mirai",
        coordinates: [26.215562033867368, 50.59237266757529],
        description: "Mirai is my favorite Japanese restaurant ever.",
      },
    ],
    countryCodes: ["BHR"],
    countryNames: ["Bahrain"],
  },
  germany: {
    buttonLabel: "Chapter 2 — Germany",
    title: "Germany",
    text: "Studying in Germany had always been part of my plan. I was always inspired by its engineering excellence and design.",
    coordinates: [52.52, 13.405],
    bounds: [
      [46.8, 1.8],
      [56.4, 19.2],
    ],
    exploreBounds: [
      [45.8, 0.5],
      [57.2, 20.5],
    ],
    cities: [
      { name: "Berlin", coordinates: [52.52, 13.405] },
      { name: "TH Wildau", coordinates: [52.3194, 13.6325] },
      { name: "Frankfurt", coordinates: [50.1109, 8.6821] },
    ],
    pois: {
      overview: [],
      berlin: [
        {
          name: "Eurasia Sprachschule",
          coordinates: [52.53312374677974, 13.27990508838696],
          description:
            "This is where I started my learning journey. I completed A1–B1 German at this institute.",
        },
      ],
      frankfurt: [
        {
          name: "Sprachcaffe Language School",
          coordinates: [50.10468946112161, 8.682346656854943],
          description:
            "This is where I gained my first exposure to the German language and built the basis for my studies.",
        },
      ],
      wildau: [],
    },
    countryCodes: ["DEU"],
    countryNames: ["Germany"],
  },
};

export default JOURNEY_DATA;