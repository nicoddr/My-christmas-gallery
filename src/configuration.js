// Hallway Gallery configuration: defaults, normalization and editor descriptors.
// One portable contract serves the live preview, saved settings and every delivery.

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// Built-in placeholder media used when no custom imageUrls are supplied.
export const media = freeze([
  { id: "print-ribbon-flow", label: "Ribbon flow", alt: "Artwork 1", src: new URL("../demo/media/print-ribbon-flow.webp", import.meta.url).href },
  { id: "crate-split-sun", label: "Split sun", alt: "Artwork 2", src: new URL("../demo/media/crate-split-sun.webp", import.meta.url).href },
  { id: "print-line-fan", label: "Line fan", alt: "Artwork 3", src: new URL("../demo/media/print-line-fan.webp", import.meta.url).href },
  { id: "crate-arc-stack", label: "Arc stack", alt: "Artwork 4", src: new URL("../demo/media/crate-arc-stack.webp", import.meta.url).href },
  { id: "print-checker-lens", label: "Checker lens", alt: "Artwork 5", src: new URL("../demo/media/print-checker-lens.webp", import.meta.url).href },
  { id: "crate-blue-bars", label: "Blue bars", alt: "Artwork 6", src: new URL("../demo/media/crate-blue-bars.webp", import.meta.url).href },
  { id: "print-contour-pair", label: "Contour pair", alt: "Artwork 7", src: new URL("../demo/media/print-contour-pair.webp", import.meta.url).href },
  { id: "crate-red-orbit", label: "Red orbit", alt: "Artwork 8", src: new URL("../demo/media/crate-red-orbit.webp", import.meta.url).href },
  { id: "print-folded-shards", label: "Folded shards", alt: "Artwork 9", src: new URL("../demo/media/print-folded-shards.webp", import.meta.url).href },
  { id: "crate-offset-target", label: "Offset target", alt: "Artwork 10", src: new URL("../demo/media/crate-offset-target.webp", import.meta.url).href },
  { id: "print-stepped-rhythm", label: "Stepped rhythm", alt: "Artwork 11", src: new URL("../demo/media/print-stepped-rhythm.webp", import.meta.url).href },
  { id: "crate-halftone-knot", label: "Halftone knot", alt: "Artwork 12", src: new URL("../demo/media/crate-halftone-knot.webp", import.meta.url).href },
  { id: "print-halftone-cut", label: "Halftone cut", alt: "Artwork 13", src: new URL("../demo/media/print-halftone-cut.webp", import.meta.url).href },
  { id: "crate-paper-fan-cut", label: "Paper fan", alt: "Artwork 14", src: new URL("../demo/media/crate-paper-fan-cut.webp", import.meta.url).href },
  { id: "print-radial-pulse", label: "Radial pulse", alt: "Artwork 15", src: new URL("../demo/media/print-radial-pulse.webp", import.meta.url).href },
  { id: "crate-chrome-band", label: "Chrome band", alt: "Artwork 16", src: new URL("../demo/media/crate-chrome-band.webp", import.meta.url).href },
]);

export const MAX_SLOTS = 24;
export const SLOTS = MAX_SLOTS;

const SLOTS_LIST = Array.from({ length: MAX_SLOTS }, (_, index) => media[index % media.length]);

export const displays = freeze([
  { value: "canvas", label: "Canvas" },
  { value: "white-canvas", label: "White canvas" },
  { value: "framed", label: "Framed" },
  { value: "float", label: "Float frame" },
]);
const DISPLAY_VALUES = displays.map(item => item.value);

export const fits = freeze([
  { value: "natural", label: "Own proportions" },
  { value: "fill", label: "Fill the size" },
]);

export const walls = freeze([
  { value: "both", label: "Both walls" },
  { value: "outer", label: "Outer wall" },
]);

// The canonical media path/URL value: a JPEG, PNG or WebP data URL,
// a relative/project path kept as written, or an http(s) URL without credentials.
export function safeImage(value) {
  if (typeof value !== "string" || value.length > 2_000_000) return "";
  if (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
  if (value.length > 2048 || /[\s<>\\\u0000-\u001f\u007f]/.test(value) || value.startsWith("//")) return "";
  if (/^(?:\.\.?\/|\/)/.test(value)) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && url.href.length <= 2048 ? url.href : "";
  } catch {
    return "";
  }
}

// [key, label, min, max, step, unit, default]
const RANGES = [
  ["artworkCount", "Number of artworks", 4, MAX_SLOTS, 1, "", 19],
  ["artWidth", "Artwork width", 40, 200, 1, "cm", 90],
  ["artHeight", "Artwork height", 40, 200, 1, "cm", 110],
  ["cornerRadius", "Artwork corners", 0, 20, 0.5, "cm", 0],
  ["spacing", "Space between artworks", 40, 400, 5, "cm", 155],
  ["hangHeight", "Hanging height", 110, 220, 1, "cm", 155],
  ["bend", "Hallway bend", 0, 100, 1, "%", 55],
  ["hallWidth", "Hallway width", 300, 800, 10, "cm", 460],
  ["frameWidth", "Frame width", 1, 10, 0.5, "cm", 3.5],
  ["matWidth", "White border", 0, 20, 0.5, "cm", 7],
  ["depth", "Canvas depth", 1.5, 8, 0.5, "cm", 4],
  ["lighting", "Gallery lights", 0, 100, 1, "%", 76],
  ["warmth", "Light warmth", 0, 100, 1, "%", 65],
  ["walkSpeed", "Walking speed", 0.25, 3, 0.05, "×", 1],
  ["autoWalk", "Stroll when idle", 0, 100, 1, "%", 38],
  ["lookAround", "Look around with the pointer", 0, 100, 1, "%", 40],
];
export const ranges = freeze(Object.fromEntries(RANGES.map(([key, label, min, max, step, unit, initial]) => [key, { key, label, min, max, step, unit, initial }])));

const COLORS = {
  wallColor: "#f4efe8",
  floorColor: "#cfc4b5",
  frameColor: "#1f2b24",
  matColor: "#fbf7ef",
  panelColor: "#fcf9f4",
  panelInk: "#1d2721",
  buttonColor: "#1f2b24",
};

export const defaults = freeze({
  ...Object.fromEntries(RANGES.map(([key, , , , , , initial]) => [key, initial])),
  ...COLORS,
  display: "framed",
  imageFit: "natural",
  walls: "both",
  wallLabels: true,
  christmas: true,
  wheel: true,
  mediaIds: SLOTS_LIST.map(item => item.id),
  imageUrls: SLOTS_LIST.map(() => ""),
  imagePosters: SLOTS_LIST.map(() => ""),
  imageAlt: SLOTS_LIST.map((_, index) => `Memory ${index + 1}`),
  focalX: SLOTS_LIST.map(() => 50),
  focalY: SLOTS_LIST.map(() => 50),
});

const hex = (value, fallback) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
const pick = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
const flag = (value, fallback) => typeof value === "boolean" ? value : fallback;

function number(value, field) {
  const parsed = value === null || value === "" ? NaN : Number(value);
  const bounded = Number.isFinite(parsed) ? Math.min(field.max, Math.max(field.min, parsed)) : field.initial;
  return Number((Math.round(bounded / field.step) * field.step).toFixed(2));
}

export function normalize(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const selected = SLOTS_LIST.map((fallback, index) => media.find(item => item.id === input.mediaIds?.[index]) || fallback);
  const result = {};
  for (const field of Object.values(ranges)) result[field.key] = number(input[field.key], field);
  for (const [key, fallback] of Object.entries(COLORS)) result[key] = hex(input[key], fallback);
  result.display = pick(input.display, DISPLAY_VALUES, defaults.display);
  result.imageFit = pick(input.imageFit, fits.map(item => item.value), defaults.imageFit);
  result.walls = pick(input.walls, walls.map(item => item.value), defaults.walls);
  result.wallLabels = flag(input.wallLabels, defaults.wallLabels);
  result.christmas = flag(input.christmas, defaults.christmas);
  result.wheel = flag(input.wheel, defaults.wheel);
  result.mediaIds = selected.map(item => item.id);
  result.imageUrls = SLOTS_LIST.map((_, index) => safeImage(input.imageUrls?.[index]));
  result.imagePosters = SLOTS_LIST.map((_, index) => safeImage(input.imagePosters?.[index]));
  result.imageAlt = selected.map((_, index) => (typeof input.imageAlt?.[index] === "string" ? input.imageAlt[index] : `Memory ${index + 1}`).slice(0, 300));
  result.focalX = SLOTS_LIST.map((_, index) => number(input.focalX?.[index], { min: 0, max: 100, step: 1, initial: 50 }));
  result.focalY = SLOTS_LIST.map((_, index) => number(input.focalY?.[index], { min: 0, max: 100, step: 1, initial: 50 }));
  return result;
}

const VIDEO_EXT = /\.(?:mp4|webm|mov)(?:$|[?#])/i;

// The media shown in each slot: a supplied image or video, else the fallback placeholder.
export function artworkImages(options) {
  const settings = normalize(options);
  return Array.from({ length: settings.artworkCount }, (_, index) => {
    const fallback = media.find(item => item.id === settings.mediaIds[index])?.src || SLOTS_LIST[index].src;
    const src = settings.imageUrls[index] || fallback;
    return {
      src,
      poster: settings.imagePosters[index] || "",
      alt: settings.imageAlt[index],
      focalX: settings.focalX[index],
      focalY: settings.focalY[index],
      isVideo: VIDEO_EXT.test(src),
    };
  });
}

// ---- Labels ------------------------------------------------------------------

const GALLERY_LABELS = {
  close: "Close",
  previous: "Previous",
  next: "Next",
  view: "View",
  gallery: "Christmas Gallery",
  play: "Play",
  pause: "Pause",
  mute: "Mute",
  unmute: "Unmute",
};

export const defaultShop = freeze({ labels: GALLERY_LABELS });

const text = (value, fallback) => typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : fallback;

export function normalizeShop(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const labels = { ...GALLERY_LABELS };
  for (const key of Object.keys(GALLERY_LABELS)) {
    labels[key] = text(input.labels?.[key], GALLERY_LABELS[key]);
  }
  return { labels };
}

// ---- Editor contract ---------------------------------------------------------

const IMAGE_GUIDE = "Each memory keeps its own proportions on the wall, fitted inside the artwork width and height.";

const range = (key, extra = {}) => {
  const { initial, ...field } = ranges[key];
  return { ...field, type: "range", ...extra };
};
const layout = (key, extra = {}) => range(key, { editorCategory: "layout", ...extra });
const paint = (key, label, hint) => ({ key, label, type: "color", editorCategory: "colors", ...(hint ? { hint } : {}) });

const imageOptions = media.map(item => ({ value: item.id, label: item.label, src: item.src, alt: item.alt }));
const imageFields = SLOTS_LIST.flatMap((_, index) => {
  const shown = { key: "artworkCount", operator: ">=", value: index + 1 };
  return [
    {
      key: `mediaIds.${index}`, label: `Memory ${index + 1}`, type: "image",
      imageUrlKey: `imageUrls.${index}`, altKey: `imageAlt.${index}`, focalXKey: `focalX.${index}`, focalYKey: `focalY.${index}`,
      crossOrigin: "anonymous", options: imageOptions, editorCategory: "images", visibleWhen: shown,
    },
    { key: `focalX.${index}`, label: `Memory ${index + 1} horizontal crop`, type: "range", min: 0, max: 100, step: 1, unit: "%", editorCategory: "images", visibleWhen: [shown, { key: "imageFit", operator: "==", value: "fill" }] },
    { key: `focalY.${index}`, label: `Memory ${index + 1} vertical crop`, type: "range", min: 0, max: 100, step: 1, unit: "%", editorCategory: "images", visibleWhen: [shown, { key: "imageFit", operator: "==", value: "fill" }] },
  ];
});

export const configurationContract = freeze({
  schemaVersion: 1,
  templateId: "hallway-gallery",
  title: "Hallway Gallery",
  defaults,
  normalize,
  toRuntimeOptions: normalize,
  presets: [],
  actions: [],
  groups: [
    {
      id: "images",
      title: "Memories",
      description: IMAGE_GUIDE,
      level: "simple",
      fields: [
        range("artworkCount", { editorCategory: "images", hint: "How many memories hang in the hallway loop." }),
        { key: "imageFit", label: "Artwork shape", type: "segmented", options: fits, editorCategory: "images" },
        ...imageFields,
      ],
    },
    {
      id: "layout",
      title: "Size & layout",
      level: "simple",
      fields: [
        layout("artWidth", { numberInput: true }),
        layout("artHeight", { numberInput: true }),
        layout("cornerRadius"),
        layout("spacing"),
        layout("hangHeight"),
        { key: "walls", label: "Hang memories on", type: "segmented", options: walls, editorCategory: "layout" },
        layout("bend"),
        layout("hallWidth"),
      ],
    },
    {
      id: "colors",
      title: "Colors",
      level: "simple",
      fields: [
        paint("wallColor", "Walls"),
        paint("floorColor", "Floor"),
        paint("frameColor", "Frame"),
        paint("matColor", "White border"),
        paint("panelColor", "Panel"),
        paint("panelInk", "Panel text"),
        paint("buttonColor", "Button"),
      ],
    },
    {
      id: "artworks",
      title: "Presentation",
      level: "simple",
      fields: [
        { key: "display", label: "Hang as", type: "segmented", options: displays },
        { ...range("frameWidth"), visibleWhen: [{ key: "display", operator: "!=", value: "canvas" }, { key: "display", operator: "!=", value: "white-canvas" }] },
        { ...range("matWidth"), visibleWhen: [{ key: "display", operator: "!=", value: "canvas" }, { key: "display", operator: "!=", value: "float" }] },
        { ...range("depth"), visibleWhen: [{ key: "display", operator: "!=", value: "framed" }] },
        { key: "wallLabels", label: "Wall date plaques", type: "toggle" },
        { key: "christmas", label: "Christmas decor", type: "toggle" },
        range("lighting"),
        range("warmth"),
      ],
    },
    {
      id: "motion",
      title: "Motion",
      level: "simple",
      fields: [
        range("walkSpeed"),
        range("autoWalk"),
        range("lookAround"),
        { key: "wheel", label: "Scroll wheel walks the hallway", type: "toggle" },
      ],
    },
  ],
});
