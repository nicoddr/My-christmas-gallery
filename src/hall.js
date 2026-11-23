import * as THREE from "./vendor/three.module.min.js";

// The hallway is a ring: a curved corridor that keeps bending to the left and
// comes back round to where it began. Its centre of curvature sits to the left
// of the starting point, so walking forward means turning with the walls.
//
// A point at angle θ and radius r from the centre is
//   centre + r · (cos θ, 0, −sin θ)
// and walking forward increases θ.

export const EYE = 1.6;
export const MAX_ARTWORKS = 24;
const TURN = Math.PI * 2;

export function ringPoint(layout, angle, radius, height = 0) {
  return new THREE.Vector3(
    layout.centre.x + radius * Math.cos(angle),
    height,
    layout.centre.z - radius * Math.sin(angle),
  );
}

// Fits the artworks around the ring: the spacing on each wall stays exactly as
// set, and the collection repeats as many times as the bend asks for.
export function planLayout(settings, sizes) {
  const count = sizes.length;
  const width = settings.hallWidth / 100;
  const boxWidth = settings.artWidth / 100;
  const pitch = boxWidth + settings.spacing / 100;
  const both = settings.walls === "both";
  const wanted = 6.5 + 40 * (1 - settings.bend / 100) ** 1.7;
  // With both walls the slots alternate sides, so each wall holds every second slot.
  const outerFor = repeats => (pitch * repeats * count) / ((both ? 2 : 1) * TURN);
  const even = repeats => !both || (repeats * count) % 2 === 0;
  // The inner wall needs room for its own artworks and the floor a real hallway.
  const fits = repeats => {
    const inner = outerFor(repeats) - width;
    const innerGap = both ? ((2 * TURN) / (repeats * count)) * inner : Infinity;
    return inner >= 2.2 && innerGap >= boxWidth + 0.15;
  };
  let repeats = Math.max(1, Math.round(((both ? 2 : 1) * TURN * (wanted + width / 2)) / (count * pitch)));
  while (!even(repeats) || (!fits(repeats) && repeats < 64)) repeats += 1;
  const slots = repeats * count;
  const outer = outerFor(repeats);
  const radius = outer - width / 2;
  const tallest = Math.max(...sizes.map(size => size.height), settings.artHeight / 100);
  const hang = settings.hangHeight / 100;
  return {
    count, slots, repeats, both, width, pitch,
    radius, outer, inner: radius - width / 2,
    step: TURN / slots,
    height: Math.max(3.6, hang + tallest / 2 + 1.1),
    hang,
    eye: Math.min(EYE, hang + 0.08),
    centre: new THREE.Vector3(-radius, 0, 0),
  };
}

// Slot m sits at angle m · step; artwork m mod count hangs there, on the outer
// wall, or alternating outer and inner walls.
export function slotPlacement(layout, slot) {
  const outer = !layout.both || slot % 2 === 0;
  const angle = slot * layout.step;
  const radius = outer ? layout.outer - 0.004 : layout.inner + 0.004;
  const towardCentre = new THREE.Vector3(-Math.cos(angle), 0, Math.sin(angle));
  const facing = outer ? towardCentre : towardCentre.clone().negate();
  return {
    slot, outer, angle, index: slot % layout.count,
    position: ringPoint(layout, angle, radius, layout.hang),
    facing,
  };
}

// ---- Shaders ---------------------------------------------------------------

const COMMON = /* glsl */ `
  uniform vec3 uCentre;
  uniform float uOuter;
  uniform float uInner;
  uniform float uHeight;
  uniform float uLight;
  uniform vec3 uWarm;
  uniform vec3 uFog;
  uniform float uFade;
  uniform float uCount;
  uniform float uSlots;
  uniform float uStep;
  uniform vec4 uArt[${MAX_ARTWORKS}];
  uniform float uHoverSlot;
  uniform float uLift;
  varying vec3 vWorld;

  const float TAU = 6.28318530718;

  float angleOf(vec3 p) {
    vec3 d = p - uCentre;
    return mod(atan(-d.z, d.x), TAU);
  }
  float wrapAngle(float a) {
    return mod(a + 3.14159265359, TAU) - 3.14159265359;
  }
  float boxSdf(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }
  // The artwork in slot j, as (half width, half height, centre height, 1).
  // Slots are whole numbers; compare with a margin so float rounding never misses one.
  vec4 artIn(float slot) {
    float index = mod(floor(slot + 0.5), uCount);
    vec4 art = vec4(0.0);
    for (int i = 0; i < ${MAX_ARTWORKS}; i++) {
      if (abs(float(i) - index) < 0.5) art = uArt[i];
    }
    return art;
  }
  vec3 finish(vec3 colour) {
    float distance = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-max(distance - 3.0, 0.0) * 0.026);
    colour = mix(colour, uFog, clamp(fog * 0.85, 0.0, 0.85));
    return mix(colour, uFog, uFade * 0.42);
  }
`;

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Walls: an arched pool of light around every artwork, the soft shadow the
// artwork throws on the wall, and darker corners at the floor and ceiling.
const WALL = /* glsl */ `
  uniform vec3 uColour;
  uniform float uRadius;
  uniform float uFirstSlot;
  uniform float uStride;
  uniform float uHung;
  ${COMMON}

  void main() {
    float theta = angleOf(vWorld);
    float y = vWorld.y;
    float local = (theta - uFirstSlot * uStep) / (uStep * uStride);
    float nearest = floor(local + 0.5);
    float glow = 0.0;
    float shadow = 0.0;
    for (int k = -1; k <= 1; k++) {
      if (uHung < 0.5) break;
      float j = nearest + float(k);
      float slot = mod(j * uStride + uFirstSlot, uSlots);
      vec4 art = artIn(slot);
      if (art.w < 0.5) continue;
      float u = wrapAngle(theta - (j * uStride + uFirstSlot) * uStep) * uRadius;
      float halfWidth = art.x + 0.34 + art.y * 0.12;
      float bottom = art.z - art.y - 0.42;
      float top = art.z + art.y + 0.18;
      float box = boxSdf(vec2(u, y - (bottom + top) * 0.5), vec2(halfWidth, (top - bottom) * 0.5));
      float dome = length(vec2(u, max(y - top, 0.0))) - halfWidth;
      float arch = y > top ? dome : box;
      float pool = 1.0 - smoothstep(-0.06, 0.42, arch);
      pool *= 0.7 + 0.3 * smoothstep(bottom, top + halfWidth, y);
      glow = max(glow, pool);
      float lifted = abs(slot - uHoverSlot) < 0.5 ? uLift : 0.0;
      float drop = 0.045 + lifted * 1.6;
      float blur = 0.05 + lifted * 2.2;
      float caster = boxSdf(vec2(u, y - (art.z - drop)), vec2(art.x - 0.01, art.y - 0.01));
      shadow = max(shadow, 1.0 - smoothstep(-blur * 0.5, blur, caster));
    }
    float base = mix(0.95, 0.78, uLight);
    float light = base + glow * (1.03 - base);
    vec3 colour = uColour * light * mix(vec3(1.0), uWarm, 0.35 + glow * 0.65 * uLight);
    colour *= 1.0 - 0.2 * exp(-y / 0.22) - 0.1 * exp(-(uHeight - y) / 0.35);
    colour *= 1.0 - shadow * (0.2 + 0.16 * uLight);
    gl_FragColor = vec4(finish(colour), 1.0);
    #include <colorspace_fragment>
  }
`;

// Floor: occlusion along both walls and a faint warm spill under each pool of light.
const FLOOR = /* glsl */ `
  uniform vec3 uColour;
  uniform float uBoth;
  ${COMMON}

  void main() {
    vec3 d = vWorld - uCentre;
    float r = length(d.xz);
    float toOuter = max(uOuter - r, 0.0);
    float toInner = max(r - uInner, 0.0);
    float theta = angleOf(vWorld);
    float nearest = floor(theta / uStep + 0.5);
    float spill = 0.0;
    for (int k = -1; k <= 1; k++) {
      float j = nearest + float(k);
      float slot = mod(j, uSlots);
      vec4 art = artIn(slot);
      if (art.w < 0.5) continue;
      float u = wrapAngle(theta - j * uStep) * r;
      bool outerSlot = uBoth < 0.5 || mod(slot, 2.0) < 0.5;
      float fromWall = outerSlot ? toOuter : toInner;
      spill = max(spill, exp(-u * u / (2.0 * pow(art.x + 0.35, 2.0))) * exp(-fromWall / 0.9));
    }
    float occlusion = 1.0 - 0.3 * exp(-toOuter / 0.35) - 0.3 * exp(-toInner / 0.35);
    float middle = 1.0 - abs(toOuter - toInner) / max(uOuter - uInner, 0.01);
    vec3 colour = uColour * (0.9 + 0.08 * middle) * occlusion;
    colour *= mix(vec3(1.0), uWarm, 0.3);
    colour += uColour * uWarm * spill * 0.16 * uLight;
    gl_FragColor = vec4(finish(colour), 1.0);
    #include <colorspace_fragment>
  }
`;

const CEILING = /* glsl */ `
  uniform vec3 uColour;
  ${COMMON}

  void main() {
    vec3 d = vWorld - uCentre;
    float r = length(d.xz);
    float toOuter = max(uOuter - r, 0.0);
    float toInner = max(r - uInner, 0.0);
    float occlusion = 1.0 - 0.16 * exp(-toOuter / 0.45) - 0.16 * exp(-toInner / 0.45);
    vec3 colour = uColour * 1.02 * occlusion * mix(vec3(1.0), uWarm, 0.25);
    gl_FragColor = vec4(finish(colour), 1.0);
    #include <colorspace_fragment>
  }
`;

function sharedUniforms() {
  return {
    uCentre: { value: new THREE.Vector3() },
    uOuter: { value: 10 },
    uInner: { value: 6 },
    uHeight: { value: 4 },
    uLight: { value: 0.7 },
    uWarm: { value: new THREE.Color(1, 1, 1) },
    uFog: { value: new THREE.Color(1, 1, 1) },
    uFade: { value: 0 },
    uCount: { value: 1 },
    uSlots: { value: 1 },
    uStep: { value: 1 },
    uArt: { value: Array.from({ length: MAX_ARTWORKS }, () => new THREE.Vector4()) },
    uHoverSlot: { value: -1 },
    uLift: { value: 0 },
  };
}

export function createHall() {
  const shared = sharedUniforms();
  const material = (fragmentShader, extra, side) => new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader,
    side,
    uniforms: { ...shared, uColour: { value: new THREE.Color() }, ...extra },
  });
  const outerWall = material(WALL, { uRadius: { value: 1 }, uFirstSlot: { value: 0 }, uStride: { value: 1 }, uHung: { value: 1 } }, THREE.BackSide);
  const innerWall = material(WALL, { uRadius: { value: 1 }, uFirstSlot: { value: 0 }, uStride: { value: 1 }, uHung: { value: 1 } }, THREE.FrontSide);
  const floor = material(FLOOR, { uBoth: { value: 1 } }, THREE.DoubleSide);
  const ceiling = material(CEILING, {}, THREE.DoubleSide);
  // Walls and ceiling share the wall colour object so both follow it.
  ceiling.uniforms.uColour = innerWall.uniforms.uColour = outerWall.uniforms.uColour;

  const group = new THREE.Group();
  const meshes = {
    outer: new THREE.Mesh(new THREE.BufferGeometry(), outerWall),
    inner: new THREE.Mesh(new THREE.BufferGeometry(), innerWall),
    floor: new THREE.Mesh(new THREE.BufferGeometry(), floor),
    ceiling: new THREE.Mesh(new THREE.BufferGeometry(), ceiling),
  };
  Object.values(meshes).forEach(mesh => {
    mesh.frustumCulled = false;
    group.add(mesh);
  });

  function shape(layout) {
    const segments = Math.min(720, Math.max(160, Math.round(layout.outer * 18)));
    for (const mesh of Object.values(meshes)) mesh.geometry.dispose();
    meshes.outer.geometry = new THREE.CylinderGeometry(layout.outer, layout.outer, layout.height, segments, 1, true);
    meshes.inner.geometry = new THREE.CylinderGeometry(layout.inner, layout.inner, layout.height, Math.round(segments * 0.7), 1, true);
    meshes.floor.geometry = new THREE.RingGeometry(layout.inner, layout.outer, segments, 2).rotateX(-Math.PI / 2);
    meshes.ceiling.geometry = new THREE.RingGeometry(layout.inner, layout.outer, segments, 2).rotateX(Math.PI / 2);
    for (const mesh of [meshes.outer, meshes.inner]) mesh.position.set(layout.centre.x, layout.height / 2, layout.centre.z);
    meshes.floor.position.set(layout.centre.x, 0, layout.centre.z);
    meshes.ceiling.position.set(layout.centre.x, layout.height, layout.centre.z);
    shared.uCentre.value.copy(layout.centre);
    shared.uOuter.value = layout.outer;
    shared.uInner.value = layout.inner;
    shared.uHeight.value = layout.height;
    shared.uCount.value = layout.count;
    shared.uSlots.value = layout.slots;
    shared.uStep.value = layout.step;
    outerWall.uniforms.uRadius.value = layout.outer;
    innerWall.uniforms.uRadius.value = layout.inner;
    const stride = layout.both ? 2 : 1;
    outerWall.uniforms.uStride.value = stride;
    innerWall.uniforms.uStride.value = stride;
    // With both walls the outer wall holds the even slots and the inner wall the odd ones.
    outerWall.uniforms.uFirstSlot.value = 0;
    innerWall.uniforms.uFirstSlot.value = layout.both ? 1 : 0;
    floor.uniforms.uBoth.value = layout.both ? 1 : 0;
    // With every artwork on the outer wall, the inner wall stays bare.
    innerWall.uniforms.uHung.value = layout.both ? 1 : 0;
  }

  // sizes[i] = { width, height } of artwork i in metres, frame included.
  function hang(layout, sizes) {
    shared.uArt.value.forEach((value, index) => {
      const size = sizes[index];
      if (size) value.set(size.width / 2, size.height / 2, layout.hang, 1);
      else value.set(0, 0, 0, 0);
    });
  }

  function paint(settings, warm) {
    outerWall.uniforms.uColour.value.set(settings.wallColor);
    floor.uniforms.uColour.value.set(settings.floorColor);
    shared.uLight.value = settings.lighting / 100;
    shared.uWarm.value.copy(warm);
    // The far end of the hallway fades toward a lighter wall colour; dark walls stay dark.
    const wall = new THREE.Color(settings.wallColor);
    const luminance = 0.2126 * wall.r + 0.7152 * wall.g + 0.0722 * wall.b;
    const fog = wall.clone().lerp(new THREE.Color(1, 1, 1), 0.5 * Math.min(1, luminance * 1.4));
    shared.uFog.value.copy(fog);
  }

  return {
    group,
    shape,
    hang,
    paint,
    setFade(value) {
      shared.uFade.value = value;
    },
    setHover(slot, lift) {
      shared.uHoverSlot.value = slot;
      shared.uLift.value = lift;
    },
    dispose() {
      Object.values(meshes).forEach(mesh => mesh.geometry.dispose());
      [outerWall, innerWall, floor, ceiling].forEach(item => item.dispose());
    },
  };
}
