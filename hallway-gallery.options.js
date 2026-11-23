import { configurationContract as contract, MAX_SLOTS, media } from "./src/configuration.js";

// 18 chronological photos + video as the 19th (last) artwork.
const images = {
  "imageUrls.0": new URL("./media/photo-01.jpg", import.meta.url).href,
  "imageUrls.1": new URL("./media/photo-02.jpg", import.meta.url).href,
  "imageUrls.2": new URL("./media/photo-03.jpg", import.meta.url).href,
  "imageUrls.3": new URL("./media/photo-04.jpg", import.meta.url).href,
  "imageUrls.4": new URL("./media/photo-05.jpg", import.meta.url).href,
  "imageUrls.5": new URL("./media/photo-06.jpg", import.meta.url).href,
  "imageUrls.6": new URL("./media/photo-07.jpg", import.meta.url).href,
  "imageUrls.7": new URL("./media/photo-08.jpg", import.meta.url).href,
  "imageUrls.8": new URL("./media/photo-09.jpg", import.meta.url).href,
  "imageUrls.9": new URL("./media/photo-10.jpg", import.meta.url).href,
  "imageUrls.10": new URL("./media/photo-11.jpg", import.meta.url).href,
  "imageUrls.11": new URL("./media/photo-12.jpg", import.meta.url).href,
  "imageUrls.12": new URL("./media/photo-13.jpg", import.meta.url).href,
  "imageUrls.13": new URL("./media/photo-14.jpg", import.meta.url).href,
  "imageUrls.14": new URL("./media/photo-15.jpg", import.meta.url).href,
  "imageUrls.15": new URL("./media/photo-16.jpg", import.meta.url).href,
  "imageUrls.16": new URL("./media/photo-17.jpg", import.meta.url).href,
  "imageUrls.17": new URL("./media/photo-18.jpg", import.meta.url).href,
  "imageUrls.18": new URL("./media/video-19.mp4", import.meta.url).href,
  "imagePosters.18": new URL("./media/video-19-poster.jpg", import.meta.url).href,
};

const altTexts = [
  "Photo from October 5, 2026",
  "Photo from October 6, 2026",
  "Photo from October 9, 2026",
  "Photo from October 10, 2026",
  "Photo from October 11, 2026",
  "Photo from October 11, 2026",
  "Photo from October 24, 2026",
  "Photo from October 24, 2026",
  "Photo from November 6, 2026",
  "Photo from November 6, 2026",
  "Photo from November 6, 2026",
  "Photo from November 2026",
  "Photo from November 8, 2026",
  "Photo from November 9, 2026",
  "Photo from November 21, 2026",
  "Photo from November 21, 2026",
  "Photo from November 22, 2026",
  "Photo from November 22, 2026",
  "Video from October 4, 2026",
];

const saved = {
  assetId: "hallway-gallery",
  configurationSchemaVersion: 1,
  values: {
    artworkCount: 19,
    artWidth: 90,
    artHeight: 110,
    cornerRadius: 0,
    spacing: 155,
    hangHeight: 155,
    bend: 55,
    hallWidth: 460,
    frameWidth: 3.5,
    matWidth: 7,
    depth: 4,
    lighting: 76,
    warmth: 65,
    walkSpeed: 1,
    autoWalk: 38,
    lookAround: 40,
    wallColor: "#f4efe8",
    floorColor: "#cfc4b5",
    frameColor: "#1f2b24",
    matColor: "#fbf7ef",
    panelColor: "#fcf9f4",
    panelInk: "#1d2721",
    buttonColor: "#1f2b24",
    display: "framed",
    imageFit: "natural",
    walls: "both",
    wallLabels: true,
    christmas: true,
    wheel: true,
    mediaIds: Array.from({ length: MAX_SLOTS }, (_, i) => media[i % media.length].id),
    imageUrls: Array.from({ length: MAX_SLOTS }, () => ""),
    imagePosters: Array.from({ length: MAX_SLOTS }, () => ""),
    imageAlt: Array.from({ length: MAX_SLOTS }, (_, i) => altTexts[i] || `Memory ${i + 1}`),
    focalX: Array.from({ length: MAX_SLOTS }, () => 50),
    focalY: Array.from({ length: MAX_SLOTS }, () => 50),
  },
};

if (saved.assetId !== contract.templateId || saved.configurationSchemaVersion !== contract.schemaVersion) {
  throw new Error("Settings do not match this asset configuration contract.");
}

const values = contract.normalize(saved.values);
for (const [key, path] of Object.entries(images)) {
  const parts = key.split(".");
  parts.slice(0, -1).reduce((owner, part) => owner[part], values)[parts.at(-1)] = path;
}
const configured = contract.normalize(values);

if (typeof document !== "undefined") {
  for (const key of Object.keys(images)) {
    if (!key.split(".").reduce((value, part) => value?.[part], configured)) {
      console.warn(`${key}: this media path is not supported.`);
    }
  }
}

export default contract.toRuntimeOptions(configured);
