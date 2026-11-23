import * as THREE from "./vendor/three.module.min.js";
import { artworkImages, normalize, normalizeShop } from "./configuration.js";
import { createHall, planLayout, slotPlacement } from "./hall.js";
import { buildArtwork, cropFor, labelTexture, measure } from "./artwork.js";
import { createChristmasDecor } from "./christmas.js";

// Hallway Gallery: a curved Christmas hallway hung with photos and video memories.
// Walking, scrolling, dragging or swiping explores the corridor; choosing a frame
// walks up to it and opens a date-only information panel (plus video controls when viewing a video).

const TURN = Math.PI * 2;
const NARROW = 720; // below this host width the panel opens as a compact bottom sheet
const LOOK_RIGHT = 0.07; // the walking view turns this far toward the outer wall
const WHEEL_STEP = 0.0055; // metres walked per pixel of wheel
const DRAG_STEP = 0.012; // metres walked per pixel of mouse drag
const TOUCH_DRAG_STEP = 0.015; // metres walked per pixel of touch drag
const DRAG_START = 6;
const TOUCH_DRAG_START = 12;
const IDLE_DELAY = 2600;
const STROLL = 1.6; // metres per second at full stroll
const STROLL_EASE = 1.2; // how gently the stroll gathers pace
const STROLL_STOP = 6; // how quickly it stops, so a hovered frame stays under the pointer
const LIFT = 0.035;
const SIDE_VIEW = 0.16; // radians the close view turns to one side of the frame
const NARROW_SIDE_VIEW = 0.06;

const instances = new WeakMap();

const ease = value => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);
const mix = (from, to, amount) => from + (to - from) * amount;
const wrap = value => ((((value + Math.PI) % TURN) + TURN) % TURN) - Math.PI;

function element(doc, tag, className, attributes = {}) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function mountHallwayGallery(host, input = {}, shopInput = {}) {
  if (!host || host.nodeType !== 1) throw new TypeError("mountHallwayGallery needs a host element.");
  instances.get(host)?.destroy();

  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const events = new AbortController();
  const listen = { signal: events.signal };
  const reducedQuery = win.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = reducedQuery.matches;
  let options = normalize(input);
  let shop = normalizeShop(shopInput);
  let destroyed = false;

  // The page's date metadata for each artwork: direct children marked data-artwork.
  const articles = [...host.children].filter(child => child.matches("[data-artwork]"));
  const articleHomes = articles.map(article => ({ article, next: article.nextSibling }));

  const root = element(doc, "div", "hallway-gallery", { role: "region" });
  const canvas = element(doc, "canvas", "hallway-gallery__canvas", { "aria-hidden": "true" });
  const list = element(doc, "ul", "hallway-gallery__list");
  const tip = element(doc, "div", "hallway-gallery__tip", { "aria-hidden": "true" });
  const tipTitle = element(doc, "span", "hallway-gallery__tip-title");
  const tipAction = element(doc, "span", "hallway-gallery__tip-action");
  tip.append(tipTitle, tipAction);
  const panel = element(doc, "aside", "hallway-gallery__panel", { tabindex: "-1" });
  panel.inert = true;
  const status = element(doc, "p", "hallway-gallery__status", { "aria-live": "polite" });
  const store = element(doc, "div", "hallway-gallery__store", { hidden: "" });
  store.append(...articles);

  // Panel: counter + navigation bar, date content, and optional video controls.
  const bar = element(doc, "div", "hallway-gallery__bar");
  const counter = element(doc, "span", "hallway-gallery__counter");
  const navActions = element(doc, "div", "hallway-gallery__bar-actions");
  const previousButton = element(doc, "button", "hallway-gallery__icon hallway-gallery__icon--previous", { type: "button" });
  const nextButton = element(doc, "button", "hallway-gallery__icon hallway-gallery__icon--next", { type: "button" });
  const closeButton = element(doc, "button", "hallway-gallery__icon hallway-gallery__icon--close", { type: "button" });
  navActions.append(previousButton, nextButton, closeButton);
  bar.append(counter, navActions);

  const scroller = element(doc, "div", "hallway-gallery__scroller");
  const content = element(doc, "div", "hallway-gallery__content");

  // Video controls (shown only when viewing a video memory).
  const videoControls = element(doc, "div", "hallway-gallery__video-controls", { hidden: "" });
  const videoRow = element(doc, "div", "hallway-gallery__video-row");
  const playToggle = element(doc, "button", "hallway-gallery__video-btn hallway-gallery__video-btn--primary", { type: "button" });
  const muteToggle = element(doc, "button", "hallway-gallery__video-btn", { type: "button" });
  videoRow.append(playToggle, muteToggle);
  const scrubRow = element(doc, "div", "hallway-gallery__video-scrub-row");
  const videoScrubber = element(doc, "input", "hallway-gallery__video-range", {
    type: "range", min: "0", max: "1000", value: "0", "aria-label": "Video timeline",
  });
  const videoTime = element(doc, "span", "hallway-gallery__video-time");
  videoTime.textContent = "0:00 / 0:00";
  scrubRow.append(videoScrubber, videoTime);
  const flatVideoSlot = element(doc, "div", "hallway-gallery__flat-video-slot");
  videoControls.append(videoRow, scrubRow, flatVideoSlot);

  scroller.append(content, videoControls);
  panel.append(bar, scroller);
  root.append(canvas, list, tip, panel, status, store);
  host.append(root);

  // ---- Renderer --------------------------------------------------------------

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } catch {
    renderer = null;
  }
  if (!renderer) root.classList.add("is-flat");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, 1, 0.05, 120);
  camera.rotation.order = "YXZ";
  const hall = renderer ? createHall() : null;
  if (hall) scene.add(hall.group);
  const christmas = hall ? createChristmasDecor(hall.group.children[0].material.uniforms) : null;
  if (christmas) scene.add(christmas.group);
  const artGroup = new THREE.Group();
  scene.add(artGroup);
  const shared = hall ? {
    uLight: hall.group.children[0].material.uniforms.uLight,
    uWarm: hall.group.children[0].material.uniforms.uWarm,
    uFog: hall.group.children[0].material.uniforms.uFog,
  } : null;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2(9, 9);

  // ---- State -------------------------------------------------------------------

  let layout = null;
  let images = []; // { src, poster, alt, focalX, focalY, isVideo, texture, videoTexture, video, videoReady, aspect }
  let models = []; // per artwork: the wall model
  let slots = []; // per ring slot: { placement, holder, piece, label }
  let labels = []; // per artwork: { geometry, material, texture }
  let size = { width: 1, height: 1, narrow: false, panel: 0 };
  let walk = 0;
  let walkGoal = 0;
  let look = { x: 0, y: 0, goalX: 0, goalY: 0 };
  let steer = 1;
  let pose = null;
  let flight = null;
  let mode = "walk"; // walk | open
  let selectedSlot = -1;
  let returnWalk = 0;
  let fade = 0;
  let hoverSlot = -1;
  let lift = 0;
  let liftSlot = -1;
  let lastInput = -Infinity;
  let strollSpeed = null;
  let drag = null;
  let panelSwipe = null;
  let scrubbing = false;
  let frame = 0;
  let lastTime = 0;
  let paused = false;
  let visible = true;
  let contextLost = false;
  let loadRevision = 0;
  let announcedSlot = -1;

  const artworkCount = () => options.artworkCount;
  const slotAngle = slot => slot * layout.step;

  function articleFor(index) {
    return articles[index] || null;
  }
  function titleFor(index) {
    const article = articleFor(index);
    const heading = article?.querySelector("h1, h2, h3, h4, h5, h6, [data-artwork-title]");
    return heading?.textContent.trim() || `Memory ${index + 1}`;
  }
  function lineFor(index) {
    const article = articleFor(index);
    const line = article?.querySelector("[data-wall-meta]") || article?.querySelector("[data-artwork-meta]") || article?.querySelector("p");
    return line?.textContent.trim() || "";
  }

  function emit(type, detail) {
    host.dispatchEvent(new CustomEvent(`hallway-gallery:${type}`, { bubbles: true, detail }));
  }

  // ---- Media Loading (Photos & Video) ---------------------------------------

  function loadTexture(src) {
    return new Promise((resolve, reject) => {
      const image = new win.Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => {
        const longest = Math.max(image.naturalWidth, image.naturalHeight) || 1;
        const maxTex = (win.innerWidth < NARROW || host.clientWidth < NARROW) ? 1280 : 1600;
        let source = image;
        if (longest > maxTex) {
          const scale = maxTex / longest;
          source = element(doc, "canvas");
          source.width = Math.round(image.naturalWidth * scale);
          source.height = Math.round(image.naturalHeight * scale);
          source.getContext("2d").drawImage(image, 0, 0, source.width, source.height);
        }
        const texture = new THREE.Texture(source);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.needsUpdate = true;
        resolve({ texture, aspect: image.naturalWidth / Math.max(1, image.naturalHeight) });
      };
      image.onerror = () => reject(new Error(`Hallway Gallery could not load ${src}`));
      image.src = src;
    });
  }

  const textureCache = new Map(); // src -> Promise<{ texture, aspect }>
  function textureFor(src) {
    if (!textureCache.has(src)) {
      const loading = loadTexture(src);
      loading.catch(() => textureCache.delete(src));
      textureCache.set(src, loading);
    }
    return textureCache.get(src);
  }

  const videoCache = new Map(); // src -> videoEntry
  let gestureBound = false;

  function unlockVideos() {
    for (const entry of videoCache.values()) {
      if (!entry.userPaused && entry.video.paused) {
        entry.video.play().catch(() => {});
      }
    }
  }

  function ensureGestureUnlock() {
    if (gestureBound) return;
    gestureBound = true;
    const handler = () => unlockVideos();
    doc.addEventListener("pointerdown", handler, { passive: true, signal: events.signal });
    doc.addEventListener("touchstart", handler, { passive: true, signal: events.signal });
    doc.addEventListener("keydown", handler, { passive: true, signal: events.signal });
  }

  function hasPlayingVideo() {
    for (const entry of videoCache.values()) {
      if (entry.ready && !entry.video.paused && !entry.video.ended) return true;
    }
    return false;
  }

  function muteAllVideos() {
    for (const entry of videoCache.values()) {
      entry.video.muted = true;
    }
  }

  function createVideoEntry(src, poster) {
    const video = element(doc, "video", "hallway-gallery__video-source");
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    if (poster) video.poster = poster;
    video.src = src;
    root.append(video);

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.generateMipmaps = false;

    const entry = {
      src,
      video,
      videoTexture,
      ready: false,
      userPaused: false,
    };

    const activateVideoTexture = () => {
      if (destroyed || video.readyState < 2) return;
      if (!entry.ready) {
        entry.ready = true;
        images.forEach((img, index) => {
          if (img.video === video) {
            img.videoReady = true;
            if (video.videoWidth && video.videoHeight) {
              img.aspect = video.videoWidth / video.videoHeight;
            }
            models[index]?.setTexture(videoTexture);
          }
        });
      }
      syncVideoControls();
      wake();
    };

    video.addEventListener("loadeddata", activateVideoTexture, listen);
    video.addEventListener("canplay", activateVideoTexture, listen);
    video.addEventListener("playing", activateVideoTexture, listen);
    video.addEventListener("timeupdate", () => syncVideoControls(), listen);
    video.addEventListener("play", () => {
      syncVideoControls();
      wake();
    }, listen);
    video.addEventListener("pause", () => syncVideoControls(), listen);
    video.addEventListener("volumechange", () => syncVideoControls(), listen);
    video.addEventListener("loadedmetadata", () => syncVideoControls(), listen);

    ensureGestureUnlock();
    video.play().catch(() => {});
    return entry;
  }

  function videoFor(src, poster) {
    if (!videoCache.has(src)) {
      videoCache.set(src, createVideoEntry(src, poster));
    }
    return videoCache.get(src);
  }

  async function loadMediaItem(item, onComplete) {
    if (!item.isVideo) {
      const result = await textureFor(item.src);
      onComplete();
      return { ...item, texture: result.texture, videoTexture: null, video: null, videoReady: false, aspect: result.aspect };
    }
    const videoEntry = videoFor(item.src, item.poster);
    let posterResult = null;
    if (item.poster) {
      posterResult = await textureFor(item.poster);
    } else if (videoEntry.video.readyState < 1) {
      await new Promise((resolve, reject) => {
        const onMeta = () => { cleanup(); resolve(); };
        const onErr = () => { cleanup(); reject(new Error(`Hallway Gallery could not load ${item.src}`)); };
        const cleanup = () => {
          videoEntry.video.removeEventListener("loadedmetadata", onMeta);
          videoEntry.video.removeEventListener("error", onErr);
        };
        videoEntry.video.addEventListener("loadedmetadata", onMeta, { once: true, signal: events.signal });
        videoEntry.video.addEventListener("error", onErr, { once: true, signal: events.signal });
      });
    }
    const aspect = posterResult?.aspect ||
      (videoEntry.video.videoWidth && videoEntry.video.videoHeight
        ? videoEntry.video.videoWidth / videoEntry.video.videoHeight
        : options.artWidth / options.artHeight);
    onComplete();
    return {
      ...item,
      texture: posterResult?.texture || null,
      videoTexture: videoEntry.videoTexture,
      video: videoEntry.video,
      videoReady: videoEntry.ready && videoEntry.video.readyState >= 2,
      videoEntry,
      aspect,
    };
  }

  async function loadImages() {
    const revision = ++loadRevision;
    const wanted = artworkImages(options);
    let loadedCount = 0;
    emit("progress", { loaded: 0, total: wanted.length });
    const results = await Promise.all(wanted.map(item => loadMediaItem(item, () => {
      loadedCount += 1;
      if (!destroyed && revision === loadRevision) {
        emit("progress", { loaded: loadedCount, total: wanted.length });
      }
    })));
    if (destroyed || revision !== loadRevision) return false;
    images = results;
    return true;
  }

  // ---- Scene Building --------------------------------------------------------

  function look3d(index, display = options.display) {
    const picture = images[index];
    const measured = measure(display, options, picture?.aspect || options.artWidth / options.artHeight);
    const activeTexture = picture?.videoReady && picture?.videoTexture ? picture.videoTexture : (picture?.texture || null);
    return {
      size: measured,
      look: {
        texture: activeTexture,
        crop: cropFor(measured.windowWidth / measured.windowHeight, picture?.aspect || 1, picture?.focalX ?? 50, picture?.focalY ?? 50),
        matColor: options.matColor,
        frameColor: options.frameColor,
      },
    };
  }

  function buildModel(index, display = options.display) {
    const { size: measured, look: appearance } = look3d(index, display);
    const model = buildArtwork(measured, appearance, shared);
    model.size = measured;
    return model;
  }

  function clearScene() {
    for (const slot of slots) artGroup.remove(slot.holder);
    slots = [];
    models.forEach(model => model.dispose());
    models = [];
    labels.forEach(label => {
      label.geometry.dispose();
      label.material.dispose();
      label.texture.dispose();
    });
    labels = [];
  }

  function rebuild() {
    if (!renderer) return;
    const previousSlots = layout ? walk / layout.step : 0;
    clearScene();
    const count = artworkCount();
    models = Array.from({ length: count }, (_, index) => buildModel(index));
    const sizes = models.map(model => ({ width: model.size.width, height: model.size.height }));
    layout = planLayout(options, sizes);
    hall.shape(layout);
    hall.hang(layout, sizes);
    christmas?.build(layout);
    christmas?.setEnabled(options.christmas);
    paint();
    const labelInk = readableInk(options.wallColor) === "#ffffff" ? "#f1eee8" : "#2b2926";
    labels = Array.from({ length: count }, (_, index) => {
      const texture = labelTexture(doc, titleFor(index), lineFor(index), labelInk);
      const geometry = new THREE.PlaneGeometry(0.34, 0.085);
      geometry.translate(0.17, -0.0425, 0);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
      return { geometry, material, texture };
    });
    for (let slot = 0; slot < layout.slots; slot++) {
      const placement = slotPlacement(layout, slot);
      const holder = new THREE.Group();
      holder.position.copy(placement.position);
      const z = placement.facing;
      const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
      holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, new THREE.Vector3(0, 1, 0), z));
      holder.userData.slot = slot;
      const model = models[placement.index];
      const piece = model.group.clone();
      holder.add(piece);
      const standoff = placement.outer ? (model.size.width / 2) ** 2 / (2 * layout.outer) : 0;
      placement.position.addScaledVector(placement.facing, standoff);
      holder.position.copy(placement.position);
      const tag = labels[placement.index];
      const label = new THREE.Mesh(tag.geometry, tag.material);
      label.position.set(-model.size.width / 2, -model.size.height / 2 - 0.09, 0.002);
      label.visible = options.wallLabels;
      label.userData.label = true;
      holder.add(label);
      artGroup.add(holder);
      slots.push({ placement, holder, piece, label });
    }
    walk = previousSlots * layout.step;
    walkGoal = walk;
    if (mode === "open" && selectedSlot >= 0) {
      selectedSlot = Math.min(selectedSlot, layout.slots - 1);
      pose = focusPose(selectedSlot);
      flight = null;
    } else if (!pose || !flight) {
      pose = walkPose(walk);
    }
    rebuildList();
  }

  function paint() {
    const warmth = options.warmth / 100;
    const warm = new THREE.Color().setRGB(1, mix(0.985, 0.9, warmth), mix(1.03, 0.78, warmth));
    hall.paint(options, warm);
    renderer.setClearColor(new THREE.Color(options.wallColor));
    root.style.setProperty("--hallway-panel", options.panelColor);
    root.style.setProperty("--hallway-ink", options.panelInk);
    root.style.setProperty("--hallway-button", options.buttonColor);
    root.style.setProperty("--hallway-button-ink", readableInk(options.buttonColor));
  }

  function readableInk(hex) {
    const colour = new THREE.Color(hex);
    const luminance = 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b;
    return luminance > 0.36 ? "#141312" : "#ffffff";
  }

  function rebuildList() {
    list.replaceChildren();
    for (let index = 0; index < artworkCount(); index++) {
      const item = element(doc, "li");
      const button = element(doc, "button", "hallway-gallery__item", { type: "button" });
      button.textContent = titleFor(index);
      button.addEventListener("click", () => open(index), listen);
      button.addEventListener("focus", () => {
        if (mode === "walk" && !flight) goTo(index);
      }, listen);
      item.append(button);
      list.append(item);
    }
    root.setAttribute("aria-label", shop.labels.gallery);
  }

  // ---- Camera ----------------------------------------------------------------------

  function currentSheetRatio(index) {
    if (!size.narrow) return 0;
    const isVideoOpen = index >= 0 && Boolean(images[index]?.isVideo);
    const px = isVideoOpen ? 252 : 174;
    const minR = isVideoOpen ? 0.30 : 0.21;
    const maxR = isVideoOpen ? 0.42 : 0.32;
    return THREE.MathUtils.clamp(px / Math.max(360, size.height), minR, maxR);
  }

  function updateSheetHeight(index) {
    const ratio = currentSheetRatio(index);
    if (size.narrow && ratio > 0) {
      root.style.setProperty("--hallway-sheet-height", `${(ratio * 100).toFixed(2)}%`);
    } else {
      root.style.removeProperty("--hallway-sheet-height");
    }
    return ratio;
  }

  function walkPose(angle) {
    return {
      angle,
      radius: layout.radius,
      height: layout.eye,
      yaw: angle - LOOK_RIGHT,
      pitch: 0,
      shiftX: 0,
      shiftY: 0,
    };
  }

  function focusPose(slot) {
    const placement = slotPlacement(layout, slot);
    const model = models[placement.index];
    const shown = model.size;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const aspect = size.width / size.height;
    const sheetRatio = size.narrow ? currentSheetRatio(placement.index) : 0;
    const roomX = size.narrow ? 1 : 1 - size.panel;
    const roomY = size.narrow ? 1 - sheetRatio : 1;
    const fill = size.narrow ? 0.82 : 0.74;
    const distance = THREE.MathUtils.clamp(Math.max(
      shown.height / (2 * Math.tan(half) * roomY * fill),
      shown.width / (2 * Math.tan(half) * aspect * roomX * fill),
    ), 0.7, layout.width - 0.4);
    const centre = placement.position.clone().addScaledVector(placement.facing, shown.depth / 2);
    const sideAngle = size.narrow ? NARROW_SIDE_VIEW : SIDE_VIEW;
    const right = new THREE.Vector3(0, 1, 0).cross(placement.facing).normalize();
    const toward = placement.facing.clone().multiplyScalar(Math.cos(sideAngle)).addScaledVector(right, Math.sin(sideAngle));
    const eye = centre.clone().addScaledVector(toward, distance);
    const offset = eye.clone().sub(layout.centre);
    return {
      angle: Math.atan2(-offset.z, offset.x),
      radius: Math.hypot(offset.x, offset.z),
      height: centre.y,
      yaw: Math.atan2(toward.x, toward.z),
      pitch: 0,
      shiftX: size.narrow ? 0 : size.panel,
      shiftY: size.narrow ? -sheetRatio : 0,
    };
  }

  function near(to, from) {
    return {
      ...to,
      angle: from.angle + wrap(to.angle - from.angle),
      yaw: from.yaw + wrap(to.yaw - from.yaw),
    };
  }

  function fly(to, then) {
    wake();
    const from = { ...pose };
    const target = near(to, from);
    const distance = Math.abs(target.angle - from.angle) * layout.radius;
    flight = reduced ? null : { from, to: target, start: performance.now(), duration: 900 + Math.min(1600, distance * 140), then };
    if (reduced) {
      pose = target;
      then?.();
    }
  }

  function placeCamera() {
    const p = pose;
    camera.position.set(
      layout.centre.x + p.radius * Math.cos(p.angle),
      p.height,
      layout.centre.z - p.radius * Math.sin(p.angle),
    );
    camera.rotation.y = p.yaw - look.x * steer;
    camera.rotation.x = p.pitch + look.y * steer;
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[8] = p.shiftX;
    camera.projectionMatrix.elements[9] = p.shiftY;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();
  }

  // ---- Interaction -----------------------------------------------------------------

  function nearestSlot(index, angle, ahead = 0) {
    let best = index;
    let bestDistance = Infinity;
    for (let slot = index; slot < layout.slots; slot += layout.count) {
      const distance = Math.abs(wrap(slotAngle(slot) - angle - ahead));
      if (distance < bestDistance) {
        best = slot;
        bestDistance = distance;
      }
    }
    return best;
  }

  function goTo(index) {
    if (!layout) return;
    const targetIndex = ((Number(index) % artworkCount()) + artworkCount()) % artworkCount();
    const slot = nearestSlot(targetIndex, walkGoal, 2 / layout.radius);
    walkGoal = walkGoal + wrap(slotAngle(slot) - 1.9 / layout.radius - walkGoal);
    lastInput = performance.now();
    wake();
  }

  function walkBy(metres) {
    if (!layout || mode !== "walk") return;
    walkGoal += metres / layout.radius;
    lastInput = performance.now();
    wake();
  }

  function open(target, viaSlot = false) {
    if (!layout) return;
    const index = viaSlot ? target % layout.count : ((Number(target) % artworkCount()) + artworkCount()) % artworkCount();
    if (!Number.isInteger(index)) return;
    const slot = viaSlot ? target : nearestSlot(index, mode === "open" ? slotAngle(selectedSlot) : walk, 1.5 / layout.radius);
    if (mode === "walk") returnWalk = walk;
    const changing = mode === "open" && selectedSlot !== slot;
    selectedSlot = slot;
    mode = "open";
    setHover(-1);
    muteAllVideos();
    updateSheetHeight(index);
    renderPanel(index);
    if (images[index]?.isVideo && images[index].video) {
      const entry = images[index].videoEntry;
      if (images[index].video.paused && !entry?.userPaused) {
        images[index].video.play().catch(() => {});
      }
    }
    if (!renderer) {
      root.classList.add("is-open");
      panel.inert = false;
      panel.setAttribute("aria-label", titleFor(index));
      if (!changing) panel.focus({ preventScroll: true });
      status.textContent = titleFor(index);
      emit("open", { index, slot });
      return;
    }
    fly(focusPose(slot), () => {
      root.classList.add("is-open");
    });
    if (!flight || changing) root.classList.add("is-open");
    else win.setTimeout(() => {
      if (mode === "open" && selectedSlot === slot) root.classList.add("is-open");
    }, flight.duration * 0.55);
    panel.inert = false;
    panel.setAttribute("aria-label", titleFor(index));
    if (!changing) win.setTimeout(() => panel.focus({ preventScroll: true }), reduced ? 0 : 320);
    status.textContent = titleFor(index);
    emit("open", { index, slot });
  }

  function close() {
    if (mode !== "open") return;
    const slot = selectedSlot;
    const index = slot % layout.count;
    const refocus = panel.contains(doc.activeElement);
    mode = "walk";
    muteAllVideos();
    root.classList.remove("is-open");
    panel.inert = true;
    if (!renderer) {
      returnArticle();
      flatVideoSlot.replaceChildren();
      selectedSlot = -1;
      if (refocus) list.children[index]?.firstElementChild?.focus({ preventScroll: true });
      emit("close", { index, slot });
      return;
    }
    const angle = slotAngle(slot);
    const nearby = Math.abs(wrap(angle - returnWalk)) * layout.radius < 5;
    walk = nearby ? returnWalk : angle - 2.1 / layout.radius;
    walk = pose.angle + wrap(walk - pose.angle);
    walkGoal = walk;
    fly(walkPose(walk), returnArticle);
    if (!flight) returnArticle();
    selectedSlot = -1;
    if (refocus) list.children[index]?.firstElementChild?.focus({ preventScroll: true });
    emit("close", { index, slot });
  }

  function step(direction) {
    if (mode !== "open") return;
    open((selectedSlot + direction + layout.slots) % layout.slots, true);
  }

  function returnArticle() {
    for (const article of articles) store.append(article);
  }

  // ---- Panel & Video Controls ------------------------------------------------

  function activeVideoImage() {
    if (mode !== "open" || selectedSlot < 0 || !layout) return null;
    const index = selectedSlot % layout.count;
    const item = images[index];
    return item?.isVideo ? item : null;
  }

  function syncVideoControls() {
    const item = activeVideoImage();
    if (!item || !renderer) return;
    const video = item.video;
    if (!video) return;
    const isPlaying = !video.paused && !video.ended;
    playToggle.textContent = isPlaying ? shop.labels.pause : shop.labels.play;
    playToggle.setAttribute("aria-pressed", String(isPlaying));
    muteToggle.textContent = video.muted ? shop.labels.unmute : shop.labels.mute;
    muteToggle.setAttribute("aria-pressed", String(!video.muted));
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    if (!scrubbing) {
      videoScrubber.value = duration > 0 ? String(Math.round((current / duration) * 1000)) : "0";
    }
    videoTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  }

  function renderPanel(index) {
    const article = articleFor(index);
    returnArticle();
    content.replaceChildren();
    if (article) content.append(article);
    else {
      const heading = element(doc, "h2");
      heading.textContent = titleFor(index);
      content.append(heading);
    }
    counter.textContent = `${index + 1} / ${artworkCount()}`;
    previousButton.setAttribute("aria-label", shop.labels.previous);
    nextButton.setAttribute("aria-label", shop.labels.next);
    closeButton.setAttribute("aria-label", shop.labels.close);

    const item = images[index];
    const isVideo = Boolean(item?.isVideo);
    videoControls.hidden = !isVideo;
    flatVideoSlot.replaceChildren();
    if (isVideo) {
      if (renderer) {
        videoRow.hidden = false;
        scrubRow.hidden = false;
        syncVideoControls();
      } else {
        videoRow.hidden = true;
        scrubRow.hidden = true;
        const flatVideo = element(doc, "video", "hallway-gallery__flat-video");
        flatVideo.src = item.src;
        if (item.poster) flatVideo.poster = item.poster;
        flatVideo.controls = true;
        flatVideo.playsInline = true;
        flatVideo.setAttribute("playsinline", "");
        flatVideoSlot.append(flatVideo);
      }
    }
    scroller.scrollTop = 0;
  }

  playToggle.addEventListener("click", () => {
    const item = activeVideoImage();
    if (!item?.video) return;
    if (item.video.paused) {
      if (item.videoEntry) item.videoEntry.userPaused = false;
      item.video.play().catch(() => {});
    } else {
      if (item.videoEntry) item.videoEntry.userPaused = true;
      item.video.pause();
    }
    syncVideoControls();
    wake();
  }, listen);

  muteToggle.addEventListener("click", () => {
    const item = activeVideoImage();
    if (!item?.video) return;
    item.video.muted = !item.video.muted;
    if (!item.video.muted && item.video.paused) {
      if (item.videoEntry) item.videoEntry.userPaused = false;
      item.video.play().catch(() => {});
    }
    syncVideoControls();
  }, listen);

  videoScrubber.addEventListener("pointerdown", () => {
    scrubbing = true;
  }, listen);
  const stopScrub = () => {
    scrubbing = false;
  };
  videoScrubber.addEventListener("pointerup", stopScrub, listen);
  videoScrubber.addEventListener("pointercancel", stopScrub, listen);
  videoScrubber.addEventListener("change", stopScrub, listen);
  videoScrubber.addEventListener("input", () => {
    const item = activeVideoImage();
    if (!item?.video || !Number.isFinite(item.video.duration) || item.video.duration <= 0) return;
    item.video.currentTime = (Number(videoScrubber.value) / 1000) * item.video.duration;
    videoTime.textContent = `${formatTime(item.video.currentTime)} / ${formatTime(item.video.duration)}`;
    wake();
  }, listen);

  previousButton.addEventListener("click", () => step(-1), listen);
  nextButton.addEventListener("click", () => step(1), listen);
  closeButton.addEventListener("click", close, listen);

  // Horizontal swipe navigation inside the panel when viewing an artwork on phone/touch.
  panel.addEventListener("pointerdown", event => {
    if (mode !== "open" || event.button > 0) return;
    if (event.target.closest?.("input, button, a, video, [data-no-swipe]")) return;
    panelSwipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }, listen);
  const endPanelSwipe = event => {
    if (!panelSwipe || event.pointerId !== panelSwipe.id) return;
    const dx = event.clientX - panelSwipe.x;
    const dy = event.clientY - panelSwipe.y;
    panelSwipe = null;
    if (event.type === "pointercancel" || mode !== "open") return;
    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      step(dx < 0 ? 1 : -1);
    }
  };
  panel.addEventListener("pointerup", endPanelSwipe, listen);
  panel.addEventListener("pointercancel", endPanelSwipe, listen);

  // ---- Pointer, wheel and keys -----------------------------------------------------

  function setHover(slot) {
    if (slot === hoverSlot) return;
    hoverSlot = slot;
    canvas.style.cursor = slot >= 0 ? "pointer" : "";
    if (slot < 0) {
      tip.classList.remove("is-visible");
      return;
    }
    tipTitle.textContent = titleFor(slot % layout.count);
    tipAction.textContent = shop.labels.view;
    tip.classList.add("is-visible");
  }

  function pick(clientX, clientY) {
    if (!renderer || !layout) return -1;
    const box = canvas.getBoundingClientRect();
    pointerNdc.set(((clientX - box.left) / box.width) * 2 - 1, -((clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(slots.map(slot => slot.holder), true);
    for (const hit of hits) {
      if (hit.object.userData.label || hit.object.parent?.userData.glass) continue;
      let node = hit.object;
      while (node && node.userData.slot === undefined) node = node.parent;
      if (node && hit.distance < 30) return node.userData.slot;
    }
    return -1;
  }

  canvas.addEventListener("pointermove", event => {
    wake();
    const box = canvas.getBoundingClientRect();
    if (event.pointerType === "mouse") {
      look.goalX = ((event.clientX - box.left) / box.width - 0.5) * 2;
      look.goalY = ((event.clientY - box.top) / box.height - 0.5) * 2;
    }
    if (drag && event.pointerId === drag.pointerId) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      const threshold = event.pointerType === "touch" ? TOUCH_DRAG_START : DRAG_START;
      if (!drag.moved && Math.hypot(dx, dy) > threshold) {
        drag.moved = true;
        canvas.setPointerCapture?.(event.pointerId);
        root.classList.add("is-dragging");
      }
      if (drag.moved && mode === "walk") {
        const along = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
        const stepSize = event.pointerType === "touch" ? TOUCH_DRAG_STEP : DRAG_STEP;
        walkGoal = drag.goal - (along * stepSize * options.walkSpeed) / layout.radius;
        lastInput = performance.now();
      }
      return;
    }
    if (!drag && event.pointerType === "mouse") {
      tip.style.transform = `translate(${event.clientX - box.left + 16}px, ${event.clientY - box.top + 18}px)`;
      setHover(mode === "walk" || mode === "open" ? pick(event.clientX, event.clientY) : -1);
      if (mode === "open" && hoverSlot === selectedSlot) setHover(-1);
    }
  }, listen);
  canvas.addEventListener("pointerleave", () => {
    wake();
    look.goalX = 0;
    look.goalY = 0;
    setHover(-1);
  }, listen);
  canvas.addEventListener("pointerdown", event => {
    if (event.button > 0 || drag) return;
    wake();
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, goal: walkGoal, moved: false };
  }, listen);
  const endDrag = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const moved = drag.moved;
    drag = null;
    root.classList.remove("is-dragging");
    if (event.type === "pointercancel") return;
    if (moved) {
      if (mode === "open" && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        step(dx < 0 ? 1 : -1);
      }
      return;
    }
    const slot = pick(event.clientX, event.clientY);
    if (slot >= 0 && slot !== selectedSlot) {
      open(slot, true);
    } else if (mode === "open" && slot < 0) close();
  };
  canvas.addEventListener("pointerup", endDrag, listen);
  canvas.addEventListener("pointercancel", endDrag, listen);

  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    contextLost = true;
    win.cancelAnimationFrame(frame);
    frame = 0;
  }, listen);
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    wake();
  }, listen);

  root.addEventListener("wheel", event => {
    if (!options.wheel || panel.contains(event.target)) return;
    event.preventDefault();
    if (mode !== "walk") return;
    const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1;
    const delta = (Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * lines;
    walkBy(Math.max(-240, Math.min(240, delta)) * WHEEL_STEP * options.walkSpeed);
  }, { passive: false, signal: events.signal });

  root.addEventListener("keydown", event => {
    if (event.key === "Escape" && mode === "open") {
      event.preventDefault();
      close();
      return;
    }
    if (event.target.closest?.(".hallway-gallery__panel")) return;
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!keys[event.key] || !layout) return;
    event.preventDefault();
    const items = [...list.querySelectorAll("button")];
    const current = items.indexOf(doc.activeElement);
    const from = current >= 0 ? current : slotAhead() % layout.count;
    items[(from + keys[event.key] + items.length) % items.length]?.focus();
  }, listen);

  function slotAhead(angle = walk) {
    if (!layout) return 0;
    return ((Math.round((angle + 1.9 / layout.radius) / layout.step) % layout.slots) + layout.slots) % layout.slots;
  }

  const onReduced = event => {
    reduced = event.matches;
    wake();
  };
  reducedQuery.addEventListener?.("change", onReduced, listen);

  // ---- Size and visibility -----------------------------------------------------------

  function measureHost() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const narrow = width < NARROW;
    const panelWidth = narrow ? width : Math.min(440, Math.max(320, width * 0.34));
    size = { width, height, narrow, panel: narrow ? 0 : panelWidth / width };
    root.classList.toggle("is-narrow", narrow);
    updateSheetHeight(mode === "open" && selectedSlot >= 0 && layout ? selectedSlot % layout.count : -1);
    if (!renderer) return;
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, narrow ? 1.75 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const wide = THREE.MathUtils.degToRad(54);
    camera.fov = Math.min(80, Math.max(56, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(wide / 2) / camera.aspect))));
    if (mode === "open" && selectedSlot >= 0 && layout) {
      pose = focusPose(selectedSlot);
      flight = null;
    }
    wake();
  }
  const resizer = new win.ResizeObserver(() => measureHost());
  resizer.observe(host);
  const watcher = "IntersectionObserver" in win ? new win.IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible) wake();
  }) : null;
  watcher?.observe(host);
  doc.addEventListener("visibilitychange", () => {
    if (!doc.hidden) wake();
  }, listen);

  // ---- Frame loop --------------------------------------------------------------------

  function wake() {
    if (!frame && !destroyed && renderer && !contextLost) {
      lastTime = performance.now();
      frame = win.requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    frame = 0;
    if (destroyed || contextLost) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (layout && pose) {
      const strolling = mode === "walk" && !flight && !drag && !reduced && !paused && options.autoWalk > 0 &&
        now - lastInput > IDLE_DELAY && hoverSlot < 0;
      const strollGoal = strolling ? STROLL * (options.autoWalk / 100) : 0;
      if (strollSpeed === null) strollSpeed = strollGoal;
      strollSpeed += (strollGoal - strollSpeed) * (1 - Math.exp(-dt * (strollGoal > strollSpeed ? STROLL_EASE : STROLL_STOP)));
      if (strollGoal === 0 && strollSpeed < 0.002) strollSpeed = 0;
      walkGoal += (strollSpeed * dt) / layout.radius;
      const follow = reduced ? 1 : 1 - Math.exp(-dt * 5);
      walk += (walkGoal - walk) * follow;
      const pointerFollow = 1 - Math.exp(-dt * 3);
      const reach = options.lookAround / 100;
      look.x += (look.goalX * 0.26 * reach - look.x) * pointerFollow;
      look.y += (-look.goalY * 0.12 * reach - look.y) * pointerFollow;
      steer += ((mode === "walk" && !flight ? 1 : 0) - steer) * (reduced ? 1 : 1 - Math.exp(-dt * 4));
      if (flight) {
        const t = Math.min(1, (now - flight.start) / flight.duration);
        const e = ease(t);
        const turn = ease(Math.min(1, Math.max(0, (t - 0.1) / 0.9)));
        pose = {
          angle: mix(flight.from.angle, flight.to.angle, e),
          radius: mix(flight.from.radius, flight.to.radius, e),
          height: mix(flight.from.height, flight.to.height, e),
          yaw: mix(flight.from.yaw, flight.to.yaw, turn),
          pitch: mix(flight.from.pitch, flight.to.pitch, e),
          shiftX: mix(flight.from.shiftX, flight.to.shiftX, e),
          shiftY: mix(flight.from.shiftY, flight.to.shiftY, e),
        };
        if (t >= 1) {
          const done = flight.then;
          flight = null;
          done?.();
        }
      } else if (mode === "walk") {
        pose = walkPose(walk);
      }
      const wantLift = hoverSlot >= 0 && mode === "walk" ? LIFT : 0;
      if (hoverSlot >= 0 && hoverSlot !== liftSlot && lift < 0.002) liftSlot = hoverSlot;
      const liftGoal = liftSlot === hoverSlot ? wantLift : 0;
      lift += (liftGoal - lift) * (reduced ? 1 : 1 - Math.exp(-dt * 10));
      for (const slot of slots) slot.holder.position.copy(slot.placement.position).addScaledVector(slot.placement.facing, slot.placement.slot === liftSlot ? lift : 0);
      hall.setHover(liftSlot, lift);
      fade += ((mode === "open" ? 1 : 0) - fade) * (reduced ? 1 : 1 - Math.exp(-dt * 4));
      hall.setFade(fade);
      christmas?.update(now / 1000, renderer.getPixelRatio(), reduced);
      placeCamera();
      renderer.render(scene, camera);
      announce();
    }
    if (!paused && visible && !doc.hidden && !contextLost && moving(now)) frame = win.requestAnimationFrame(tick);
  }

  function moving(now) {
    if (!layout || flight || drag) return true;
    if (strollSpeed > 0 || (mode === "walk" && options.autoWalk > 0 && !reduced)) return true;
    if (hasPlayingVideo()) return true;
    if (christmas?.isEnabled() && !reduced) return true;
    const liftGoal = hoverSlot >= 0 && mode === "walk" && liftSlot === hoverSlot ? LIFT : 0;
    return Math.abs(walkGoal - walk) * layout.radius > 0.0005 ||
      Math.abs(look.goalX * 0.26 * (options.lookAround / 100) - look.x) > 0.0002 ||
      Math.abs(-look.goalY * 0.12 * (options.lookAround / 100) - look.y) > 0.0002 ||
      Math.abs(liftGoal - lift) > 0.0002 ||
      Math.abs((mode === "walk" && !flight ? 1 : 0) - steer) > 0.001 ||
      Math.abs((mode === "open" ? 1 : 0) - fade) > 0.002 ||
      now - lastInput < 400;
  }

  function announce() {
    if (mode !== "walk" || flight) return;
    const slot = slotAhead();
    if (slot === announcedSlot) return;
    announcedSlot = slot;
    emit("change", { index: slot % layout.count, slot });
  }

  // ---- Public API --------------------------------------------------------------------

  async function apply(next, nextShop) {
    options = normalize(next ?? options);
    if (nextShop !== undefined) shop = normalizeShop(nextShop);
    reduced = reducedQuery.matches;
    christmas?.setEnabled(options.christmas);
    const loaded = await loadImages();
    if (!loaded || destroyed) return;
    if (!renderer) {
      layout = { count: artworkCount(), slots: artworkCount(), step: TURN / artworkCount(), radius: 1 };
      if (selectedSlot >= layout.slots) selectedSlot = layout.slots - 1;
      rebuildList();
      if (mode === "open" && selectedSlot >= 0) renderPanel(selectedSlot);
      return;
    }
    rebuild();
    if (mode === "open" && selectedSlot >= 0) renderPanel(selectedSlot % layout.count);
    wake();
  }

  measureHost();
  const ready = apply(options);
  ready.catch(() => { /* `ready` reports the error to the caller. */ });

  const controller = {
    ready,
    update(next = {}, nextShop) {
      return apply({ ...options, ...next }, nextShop);
    },
    walk(metres) {
      walkBy(Number(metres) || 0);
    },
    goTo,
    open(index) {
      open(index);
    },
    close,
    next: () => (mode === "open" ? step(1) : goTo((slotAhead(walkGoal) + 1) % (layout?.count || 1))),
    previous: () => (mode === "open" ? step(-1) : goTo((slotAhead(walkGoal) - 1 + (layout?.count || 1)) % (layout?.count || 1))),
    setPaused(value) {
      paused = Boolean(value);
      if (!paused) wake();
    },
    setAutoWalk(value) {
      options = normalize({ ...options, autoWalk: value });
      wake();
    },
    setChristmas(value) {
      options = { ...options, christmas: Boolean(value) };
      christmas?.setEnabled(options.christmas);
      wake();
    },
    render() {
      if (!renderer || destroyed) return;
      win.cancelAnimationFrame(frame);
      frame = 0;
      tick(performance.now());
    },
    reset() {
      if (mode === "open") close();
      walk = walkGoal = 0;
      lastInput = performance.now();
      if (layout) pose = walkPose(0);
      wake();
    },
    getState() {
      const index = selectedSlot >= 0 && layout ? selectedSlot % layout.count : -1;
      const projected = slot => {
        const box = new THREE.Box3().setFromObject(slot.holder);
        const corners = [box.min, box.max].map(point => point.clone().project(camera));
        return {
          left: (Math.min(corners[0].x, corners[1].x) + 1) / 2 * size.width,
          right: (Math.max(corners[0].x, corners[1].x) + 1) / 2 * size.width,
          top: (1 - Math.max(corners[0].y, corners[1].y)) / 2 * size.height,
          bottom: (1 - Math.min(corners[0].y, corners[1].y)) / 2 * size.height,
          inFront: corners.every(point => point.z < 1),
        };
      };
      return {
        options: structuredClone(options),
        renderer: renderer ? "webgl" : "flat",
        christmas: Boolean(christmas?.isEnabled()),
        layout: layout ? { radius: layout.radius, slots: layout.slots, repeats: layout.repeats, width: layout.width, both: layout.both } : null,
        walk: layout ? { angle: walk, metres: walk * (layout?.radius || 0) } : null,
        ahead: layout ? slotAhead() % layout.count : -1,
        open: mode === "open",
        flying: Boolean(flight),
        selected: index,
        selectedSlot,
        hovered: hoverSlot,
        artworks: images.map((image, position) => ({
          title: titleFor(position),
          src: image.src,
          aspect: image.aspect,
          isVideo: image.isVideo,
          size: models[position] ? { width: models[position].size.width, height: models[position].size.height } : null,
        })),
        visible: layout ? slots.map((slot, position) => ({ slot: position, index: position % layout.count, ...projected(slot) }))
          .filter(entry => entry.inFront && entry.right > 0 && entry.left < size.width && entry.bottom > 0 && entry.top < size.height) : [],
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      win.cancelAnimationFrame(frame);
      events.abort();
      resizer.disconnect();
      watcher?.disconnect();
      clearScene();
      hall?.dispose();
      christmas?.dispose();
      for (const loading of textureCache.values()) loading.then(result => result.texture.dispose(), () => {});
      for (const entry of videoCache.values()) {
        entry.video.pause();
        entry.video.removeAttribute("src");
        entry.video.load();
        entry.video.remove();
        entry.videoTexture.dispose();
      }
      videoCache.clear();
      renderer?.dispose();
      for (const { article, next } of articleHomes) {
        if (next && next.parentNode === host) host.insertBefore(article, next);
        else host.append(article);
      }
      root.remove();
      instances.delete(host);
    },
  };
  instances.set(host, controller);
  return controller;
}
