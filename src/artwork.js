import * as THREE from "./vendor/three.module.min.js";

// One artwork as it hangs: a canvas on a stretcher, a white canvas with a
// printed border, a framed print behind glass with a mat, or a canvas floating
// inside a tray frame. Every piece is built with its back against the wall at
// z = 0, centred on x and y, facing +z.

const FLOAT_GAP = 0.012;
const FRAME_DEPTH = 0.032;
const BEVEL = 0.0025;

// The outer size of the artwork and the window its image shows through, in metres.
export function measure(display, settings, aspect) {
  const boxWidth = settings.artWidth / 100;
  const boxHeight = settings.artHeight / 100;
  const frame = settings.frameWidth / 100;
  const mat = settings.matWidth / 100;
  const borders = {
    canvas: 0,
    "white-canvas": mat,
    framed: frame + mat,
    float: frame + FLOAT_GAP,
  };
  const border = Math.min(borders[display], Math.min(boxWidth, boxHeight) * 0.3);
  let windowWidth = boxWidth - border * 2;
  let windowHeight = boxHeight - border * 2;
  if (settings.imageFit === "natural") {
    windowHeight = Math.min(windowHeight, windowWidth / aspect);
    windowWidth = windowHeight * aspect;
  }
  return {
    display, border,
    frame: Math.min(frame, border),
    mat: display === "framed" ? Math.max(0, border - frame) : display === "white-canvas" ? border : 0,
    windowWidth, windowHeight,
    width: windowWidth + border * 2,
    height: windowHeight + border * 2,
    depth: display === "framed" ? FRAME_DEPTH : settings.depth / 100,
    radius: Math.min(settings.cornerRadius / 100, (Math.min(windowWidth, windowHeight) + border * 2) / 2 - 0.002),
  };
}

// The part of the image that fills the window: cropped around the focal point
// when the window has another proportion, whole otherwise.
export function cropFor(windowAspect, imageAspect, focalX, focalY) {
  if (Math.abs(windowAspect - imageAspect) < 0.002) return new THREE.Vector4(1, 1, 0, 0);
  if (imageAspect > windowAspect) {
    const scale = windowAspect / imageAspect;
    return new THREE.Vector4(scale, 1, (1 - scale) * (focalX / 100), 0);
  }
  const scale = imageAspect / windowAspect;
  return new THREE.Vector4(1, scale, 0, (1 - scale) * (1 - focalY / 100));
}

function roundedRect(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r < 0.0005) {
    shape.moveTo(x, y);
    shape.lineTo(x + width, y);
    shape.lineTo(x + width, y + height);
    shape.lineTo(x, y + height);
    shape.lineTo(x, y);
    return shape;
  }
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

// A slab with softened edges whose front shows the face and whose sides show
// the face's outer band folded back, the way a printed canvas wraps a stretcher.
function slab(width, height, depth, radius) {
  const bevel = Math.min(BEVEL, depth / 4, width / 8, height / 8);
  const geometry = new THREE.ExtrudeGeometry(roundedRect(width - bevel * 2, height - bevel * 2, Math.max(0, radius - bevel)), {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geometry.translate(0, 0, bevel);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const flat = new THREE.Vector2();
  for (let index = 0; index < position.count; index++) {
    flat.set(position.getX(index), position.getY(index));
    if (Math.abs(normal.getZ(index)) < 0.9) {
      const sideways = new THREE.Vector2(normal.getX(index), normal.getY(index));
      if (sideways.lengthSq() > 1e-6) sideways.normalize();
      flat.addScaledVector(sideways, -Math.max(0, depth - position.getZ(index)));
    }
    uv.setXY(index, THREE.MathUtils.clamp(flat.x / width + 0.5, 0, 1), THREE.MathUtils.clamp(flat.y / height + 0.5, 0, 1));
  }
  uv.needsUpdate = true;
  return geometry;
}

function face(width, height, radius) {
  const geometry = radius > 0.0005 ? new THREE.ShapeGeometry(roundedRect(width, height, radius), 8) : new THREE.PlaneGeometry(width, height);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let index = 0; index < position.count; index++) {
    uv.setXY(index, position.getX(index) / width + 0.5, position.getY(index) / height + 0.5);
  }
  uv.needsUpdate = true;
  return geometry;
}

function moulding(width, height, border, depth, radius) {
  const outline = roundedRect(width, height, radius);
  const hole = roundedRect(width - border * 2, height - border * 2, Math.max(0, radius - border));
  outline.holes.push(new THREE.Path(hole.getPoints(8).reverse()));
  const bevel = Math.min(0.004, border / 3);
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.6,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geometry.translate(0, 0, bevel);
  return geometry;
}

// ---- Materials ----------------------------------------------------------------

const ART_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalLocal;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vNormalLocal = normal;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ART_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec4 uRect;
  uniform vec4 uCrop;
  uniform vec3 uPaper;
  uniform vec2 uFace;
  uniform float uWindowRadius;
  uniform float uEdgeShadow;
  uniform float uBevel;
  uniform float uSheen;
  uniform float uLight;
  uniform vec3 uWarm;
  uniform vec3 uFog;
  varying vec2 vUv;
  varying vec3 vNormalLocal;
  varying vec3 vWorld;

  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec3 normal = normalize(vNormalLocal);
    vec3 light = normalize(vec3(0.0, 0.55, 0.83));
    float diffuse = 0.5 + 0.5 * max(dot(normal, light), 0.0);
    vec3 colour = uPaper;
    vec2 size = (uRect.zw - uRect.xy);
    vec2 centre = (uRect.xy + uRect.zw) * 0.5;
    float window = roundedBox((vUv - centre) * uFace, size * uFace * 0.5, uWindowRadius);
    if (uHasMap > 0.5) {
      vec2 inside = clamp((vUv - uRect.xy) / size, 0.0, 1.0);
      vec3 picture = texture2D(uMap, uCrop.zw + inside * uCrop.xy).rgb;
      colour = mix(colour, picture, 1.0 - smoothstep(-0.0005, 0.0005, window));
    }
    if (uBevel > 0.5) {
      float cut = smoothstep(0.0, 0.0006, window) * (1.0 - smoothstep(0.0022, 0.003, window));
      colour = mix(colour, min(uPaper * 1.1, vec3(1.0)), cut);
      colour *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.004, abs(window))) * step(window, 0.0) * step(0.5, uHasMap);
    }
    if (uEdgeShadow > 0.0) {
      vec2 edge = min(vUv, 1.0 - vUv) * uFace;
      float top = (1.0 - vUv.y) * uFace.y;
      colour *= 1.0 - uEdgeShadow * (0.26 * exp(-min(edge.x, edge.y) / 0.005) + 0.22 * exp(-top / 0.012));
    }
    float front = step(0.9, normal.z);
    colour *= diffuse * mix(1.0, 0.94 + 0.08 * vUv.y, front);
    colour *= 0.9 + 0.16 * uLight;
    colour *= mix(vec3(1.0), uWarm, 0.45 * uLight);
    colour += uSheen * 0.07 * max(normal.y, 0.0);
    float distance = length(vWorld - cameraPosition);
    colour = mix(colour, uFog, clamp((1.0 - exp(-max(distance - 3.0, 0.0) * 0.026)) * 0.85, 0.0, 0.85));
    gl_FragColor = vec4(colour, 1.0);
    #include <colorspace_fragment>
  }
`;

const GLASS_FRAGMENT = /* glsl */ `
  uniform vec3 uFog;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    float streak = smoothstep(0.42, 0.5, vUv.x + vUv.y * 0.55) * (1.0 - smoothstep(0.5, 0.74, vUv.x + vUv.y * 0.55));
    float corner = smoothstep(0.55, 1.0, vUv.y) * 0.5;
    float alpha = 0.035 + streak * 0.075 + corner * 0.03;
    gl_FragColor = vec4(vec3(1.0), alpha);
    #include <colorspace_fragment>
  }
`;

export function artMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexShader: ART_VERTEX,
    fragmentShader: ART_FRAGMENT,
    uniforms: {
      uMap: { value: null },
      uHasMap: { value: 0 },
      uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      uCrop: { value: new THREE.Vector4(1, 1, 0, 0) },
      uPaper: { value: new THREE.Color(1, 1, 1) },
      uFace: { value: new THREE.Vector2(1, 1) },
      uWindowRadius: { value: 0 },
      uEdgeShadow: { value: 0 },
      uBevel: { value: 0 },
      uSheen: { value: 0 },
      uLight: shared.uLight,
      uWarm: shared.uWarm,
      uFog: shared.uFog,
    },
  });
}

function glassMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexShader: ART_VERTEX,
    fragmentShader: GLASS_FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: { uFog: shared.uFog },
  });
}

// Builds the meshes for one artwork. `look` carries the colours and the image;
// the caller owns the returned materials and geometries through dispose().
export function buildArtwork(size, look, shared) {
  const group = new THREE.Group();
  const geometries = [];
  const materials = [];
  let pictureMaterial = null;
  const add = (geometry, material, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    geometries.push(geometry);
    if (!materials.includes(material)) materials.push(material);
    group.add(mesh);
    return mesh;
  };
  const picture = (faceWidth, faceHeight, inset, paper, extra = {}) => {
    const material = artMaterial(shared);
    const u = material.uniforms;
    u.uMap.value = look.texture;
    u.uHasMap.value = look.texture ? 1 : 0;
    u.uRect.value.set(inset / faceWidth, inset / faceHeight, 1 - inset / faceWidth, 1 - inset / faceHeight);
    u.uCrop.value.copy(look.crop);
    u.uPaper.value.set(paper);
    u.uFace.value.set(faceWidth, faceHeight);
    u.uWindowRadius.value = Math.max(0, Math.min(extra.windowRadius ?? 0, Math.min(size.windowWidth, size.windowHeight) / 2));
    u.uEdgeShadow.value = extra.edgeShadow ?? 0;
    u.uBevel.value = extra.bevel ? 1 : 0;
    pictureMaterial = material;
    return material;
  };
  const painted = (colour, { sheen = 0, faceWidth = 1, faceHeight = 1, edgeShadow = 0 } = {}) => {
    const material = artMaterial(shared);
    material.uniforms.uPaper.value.set(colour);
    material.uniforms.uSheen.value = sheen;
    material.uniforms.uFace.value.set(faceWidth, faceHeight);
    material.uniforms.uEdgeShadow.value = edgeShadow;
    return material;
  };

  const { width, height, depth, radius, border, frame } = size;
  if (size.display === "canvas" || size.display === "white-canvas") {
    add(slab(width, height, depth, radius), picture(width, height, border, look.matColor, { windowRadius: radius - border }));
  } else if (size.display === "framed") {
    const innerWidth = width - frame * 2;
    const innerHeight = height - frame * 2;
    const innerRadius = Math.max(0, radius - frame);
    add(moulding(width, height, frame, depth, radius), painted(look.frameColor, { sheen: 1 }));
    add(face(innerWidth + 0.002, innerHeight + 0.002, innerRadius), picture(innerWidth, innerHeight, size.mat, look.matColor, {
      edgeShadow: 1, bevel: size.mat > 0.004, windowRadius: size.mat > 0.004 ? 0 : innerRadius,
    }), depth - 0.009);
    const glass = add(face(innerWidth, innerHeight, innerRadius), glassMaterial(shared), depth - 0.004);
    glass.renderOrder = 2;
    glass.userData.glass = true;
  } else {
    const innerWidth = width - frame * 2;
    const innerHeight = height - frame * 2;
    const innerRadius = Math.max(0, radius - frame);
    add(moulding(width, height, frame, depth + 0.008, radius), painted(look.frameColor, { sheen: 1 }));
    add(face(innerWidth + 0.002, innerHeight + 0.002, innerRadius), painted("#2a2724", { faceWidth: innerWidth, faceHeight: innerHeight, edgeShadow: 1.4 }), 0.003);
    const canvasWidth = innerWidth - FLOAT_GAP * 2;
    const canvasHeight = innerHeight - FLOAT_GAP * 2;
    const canvasRadius = Math.max(0, innerRadius - FLOAT_GAP);
    add(slab(canvasWidth, canvasHeight, depth, canvasRadius), picture(canvasWidth, canvasHeight, 0, look.matColor, { windowRadius: canvasRadius }), 0.004);
  }
  return {
    group,
    setTexture(texture) {
      if (!pictureMaterial) return;
      pictureMaterial.uniforms.uMap.value = texture;
      pictureMaterial.uniforms.uHasMap.value = texture ? 1 : 0;
    },
    dispose() {
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}

// The small wall label: the artwork's date and metadata line under it.
export function labelTexture(doc, title, line, ink) {
  const canvas = doc.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = ink;
  context.textBaseline = "alphabetic";
  const fit = (text, font, max) => {
    context.font = font;
    let value = text;
    while (value.length > 1 && context.measureText(value).width > max) value = value.slice(0, -2) + "…";
    return value;
  };
  context.font = "600 62px Georgia, 'Iowan Old Style', serif";
  context.fillText(fit(title, context.font, 1000), 4, 80);
  if (line) {
    context.globalAlpha = 0.66;
    const font = "400 46px system-ui, -apple-system, 'Segoe UI', sans-serif";
    context.font = font;
    context.fillText(fit(line, font, 1000), 4, 152);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
