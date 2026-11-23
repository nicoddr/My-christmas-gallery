import * as THREE from "./vendor/three.module.min.js";
import { ringPoint } from "./hall.js";

// Tasteful 3D Christmas decor for the curved hallway:
// 1. Evergreen pine garlands draped high along both curved walls.
// 2. Twinkling champagne-gold, amber and warm berry-red fairy lights along the garlands.
// 3. GPU-animated gently falling 3D snowflakes across the corridor.

const TURN = Math.PI * 2;
const SNOW_COUNT = 280;

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const GARLAND_VERTEX = /* glsl */ `
  varying vec3 vNormalLocal;
  varying vec3 vWorld;
  void main() {
    vNormalLocal = normal;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GARLAND_FRAGMENT = /* glsl */ `
  uniform vec3 uColour;
  uniform vec3 uFog;
  uniform float uFade;
  varying vec3 vNormalLocal;
  varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vNormalLocal);
    float diffuse = 0.55 + 0.45 * max(dot(n, normalize(vec3(0.15, 0.85, 0.4))), 0.0);
    vec3 colour = uColour * diffuse;
    float distance = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-max(distance - 3.0, 0.0) * 0.026);
    colour = mix(colour, uFog, clamp(fog * 0.85, 0.0, 0.85));
    colour = mix(colour, uFog, uFade * 0.42);
    gl_FragColor = vec4(colour, 1.0);
    #include <colorspace_fragment>
  }
`;

const LIGHTS_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aSize;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vDist;
  void main() {
    vColor = aColor;
    vTwinkle = 0.72 + 0.28 * sin(uTime * 1.9 + aPhase);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDist = length(world.xyz - cameraPosition);
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    float pulse = 0.9 + 0.14 * vTwinkle;
    gl_PointSize = clamp(aSize * pulse * uPixelRatio * (260.0 / max(1.0, -mvPosition.z)), 2.5, 42.0);
  }
`;

const LIGHTS_FRAGMENT = /* glsl */ `
  uniform vec3 uFog;
  uniform float uFade;
  varying vec3 vColor;
  varying float vTwinkle;
  varying float vDist;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 7.5);
    float halo = 0.7 * exp(-d * d * 2.2) * (1.0 - smoothstep(0.6, 1.0, d));
    float intensity = core + halo;
    vec3 colour = mix(vColor, vec3(1.0, 0.98, 0.92), core * 0.75);
    float fog = clamp((1.0 - exp(-max(vDist - 4.0, 0.0) * 0.024)) * 0.8, 0.0, 0.8);
    colour = mix(colour, uFog, fog);
    float alpha = intensity * vTwinkle * (1.0 - fog * 0.75) * (1.0 - uFade * 0.48);
    gl_FragColor = vec4(colour, clamp(alpha, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

const SNOW_VERTEX = /* glsl */ `
  attribute float aTheta;
  attribute float aRadius;
  attribute float aBaseY;
  attribute float aSpeed;
  attribute float aPhase;
  attribute float aSize;
  uniform vec3 uCentre;
  uniform float uOuter;
  uniform float uInner;
  uniform float uHeight;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vDist;
  void main() {
    float span = max(1.0, uHeight - 0.25);
    float y = uHeight - 0.12 - mod(aBaseY * span + uTime * aSpeed, span);
    float theta = aTheta + sin(uTime * 0.85 + aPhase) * 0.035;
    float r = clamp(aRadius + cos(uTime * 0.65 + aPhase * 1.3) * 0.12, uInner + 0.22, uOuter - 0.22);
    vec3 pos = vec3(
      uCentre.x + r * cos(theta),
      y,
      uCentre.z - r * sin(theta)
    );
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vDist = length(world.xyz - cameraPosition);
    float nearFade = smoothstep(0.45, 1.25, vDist);
    float farFade = 1.0 - smoothstep(14.0, 32.0, vDist);
    float edgeFade = smoothstep(0.05, 0.45, y) * smoothstep(uHeight - 0.05, uHeight - 0.55, y);
    vAlpha = nearFade * farFade * edgeFade;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(aSize * uPixelRatio * (185.0 / max(1.0, -mvPosition.z)), 1.5, 22.0);
  }
`;

const SNOW_FRAGMENT = /* glsl */ `
  uniform vec3 uFog;
  uniform float uFade;
  varying float vAlpha;
  varying float vDist;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float soft = exp(-d * d * 2.8) * (1.0 - smoothstep(0.45, 1.0, d));
    vec3 snow = vec3(0.99, 0.985, 0.965);
    float fog = clamp((1.0 - exp(-max(vDist - 4.0, 0.0) * 0.026)) * 0.85, 0.0, 0.85);
    vec3 colour = mix(snow, uFog, fog * 0.5);
    float alpha = soft * vAlpha * 0.78 * (1.0 - uFade * 0.55);
    gl_FragColor = vec4(colour, clamp(alpha, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

export function createChristmasDecor(shared) {
  const group = new THREE.Group();
  let enabled = true;
  let frozenTime = 0;

  const uTime = { value: 0 };
  const uPixelRatio = { value: 1 };

  const garlandMaterial = new THREE.ShaderMaterial({
    vertexShader: GARLAND_VERTEX,
    fragmentShader: GARLAND_FRAGMENT,
    uniforms: {
      uColour: { value: new THREE.Color("#1e3d2b") },
      uFog: shared.uFog,
      uFade: shared.uFade,
    },
  });

  const lightsMaterial = new THREE.ShaderMaterial({
    vertexShader: LIGHTS_VERTEX,
    fragmentShader: LIGHTS_FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime,
      uPixelRatio,
      uFog: shared.uFog,
      uFade: shared.uFade,
    },
  });

  const snowMaterial = new THREE.ShaderMaterial({
    vertexShader: SNOW_VERTEX,
    fragmentShader: SNOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCentre: shared.uCentre,
      uOuter: shared.uOuter,
      uInner: shared.uInner,
      uHeight: shared.uHeight,
      uTime,
      uPixelRatio,
      uFog: shared.uFog,
      uFade: shared.uFade,
    },
  });

  const outerGarland = new THREE.Mesh(new THREE.BufferGeometry(), garlandMaterial);
  const innerGarland = new THREE.Mesh(new THREE.BufferGeometry(), garlandMaterial);
  const lights = new THREE.Points(new THREE.BufferGeometry(), lightsMaterial);
  const snow = new THREE.Points(new THREE.BufferGeometry(), snowMaterial);
  [outerGarland, innerGarland, lights, snow].forEach(obj => {
    obj.frustumCulled = false;
    group.add(obj);
  });

  function garlandGeometry(layout, radius, bays, yTop, yDip) {
    const samplesPerBay = 8;
    const points = [];
    for (let b = 0; b < bays; b++) {
      for (let s = 0; s < samplesPerBay; s++) {
        const f = s / samplesPerBay;
        const angle = ((b + f) / bays) * TURN;
        const y = yTop - (yTop - yDip) * Math.sin(Math.PI * f);
        points.push(ringPoint(layout, angle, radius, y));
      }
    }
    const curve = new THREE.CatmullRomCurve3(points, true);
    const segments = Math.min(480, bays * 16);
    return new THREE.TubeGeometry(curve, segments, 0.022, 6, true);
  }

  function buildLights(layout, outerR, innerR, bays, yTop, yDip, rand) {
    const bulbsPerBay = 8;
    const total = bays * bulbsPerBay * 2;
    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const phases = new Float32Array(total);
    const sizes = new Float32Array(total);

    const gold = new THREE.Color("#ffe09c");
    const amber = new THREE.Color("#ffba68");
    const berry = new THREE.Color("#df5b57");

    let idx = 0;
    for (const radius of [outerR, innerR]) {
      for (let b = 0; b < bays; b++) {
        for (let k = 0; k < bulbsPerBay; k++) {
          const f = (k + 0.5) / bulbsPerBay;
          const angle = ((b + f) / bays) * TURN;
          const y = yTop - (yTop - yDip) * Math.sin(Math.PI * f) - 0.024;
          const p = ringPoint(layout, angle, radius, y);
          positions[idx * 3] = p.x;
          positions[idx * 3 + 1] = p.y;
          positions[idx * 3 + 2] = p.z;

          const roll = rand();
          const c = roll < 0.75 ? gold : roll < 0.9 ? amber : berry;
          colors[idx * 3] = c.r;
          colors[idx * 3 + 1] = c.g;
          colors[idx * 3 + 2] = c.b;
          phases[idx] = rand() * TURN;
          sizes[idx] = 2.6 + rand() * 1.1;
          idx++;
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return geometry;
  }

  function buildSnow(layout, rand) {
    const positions = new Float32Array(SNOW_COUNT * 3);
    const thetas = new Float32Array(SNOW_COUNT);
    const radii = new Float32Array(SNOW_COUNT);
    const baseYs = new Float32Array(SNOW_COUNT);
    const speeds = new Float32Array(SNOW_COUNT);
    const phases = new Float32Array(SNOW_COUNT);
    const sizes = new Float32Array(SNOW_COUNT);

    const minR = layout.inner + 0.28;
    const maxR = Math.max(minR + 0.2, layout.outer - 0.28);

    for (let i = 0; i < SNOW_COUNT; i++) {
      thetas[i] = rand() * TURN;
      radii[i] = minR + rand() * (maxR - minR);
      baseYs[i] = rand();
      speeds[i] = 0.14 + rand() * 0.18;
      phases[i] = rand() * TURN;
      sizes[i] = 2.2 + rand() * 2.4;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aTheta", new THREE.BufferAttribute(thetas, 1));
    geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
    geometry.setAttribute("aBaseY", new THREE.BufferAttribute(baseYs, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return geometry;
  }

  function clearGeometries() {
    outerGarland.geometry.dispose();
    innerGarland.geometry.dispose();
    lights.geometry.dispose();
    snow.geometry.dispose();
  }

  function build(layout) {
    clearGeometries();
    const rand = seeded(20261225);
    const bays = Math.max(8, layout.both ? Math.round(layout.slots / 2) : layout.slots);
    const outerR = layout.outer - 0.045;
    const innerR = layout.inner + 0.045;
    const yTop = layout.height - 0.24;
    const yDip = layout.height - 0.44;

    outerGarland.geometry = garlandGeometry(layout, outerR, bays, yTop, yDip);
    innerGarland.geometry = garlandGeometry(layout, innerR, bays, yTop, yDip);
    lights.geometry = buildLights(layout, outerR, innerR, bays, yTop, yDip, rand);
    snow.geometry = buildSnow(layout, rand);
    group.visible = enabled;
  }

  function update(time, pixelRatio, reduced) {
    group.visible = enabled;
    if (!enabled) return;
    uPixelRatio.value = pixelRatio || 1;
    if (reduced) {
      uTime.value = frozenTime;
    } else {
      uTime.value = time;
      frozenTime = time;
    }
  }

  function setEnabled(flag) {
    enabled = Boolean(flag);
    group.visible = enabled;
  }

  return {
    group,
    build,
    update,
    setEnabled,
    isEnabled: () => enabled,
    dispose() {
      clearGeometries();
      garlandMaterial.dispose();
      lightsMaterial.dispose();
      snowMaterial.dispose();
    },
  };
}
