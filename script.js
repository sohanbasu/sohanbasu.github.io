/* ============================================================
   Ocean 404 — Three.js ES module scene
   ============================================================ */
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// ─── Nav helper (exposed to global for onclick) ──────────────
window.setActive = (id) => {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('nav-' + id);
  if (el) el.classList.add('active');
};

window.onload = function() {
    document.getElementById('loader').style.display = 'none';
    // Or toggle a class for a fade-out animation
    // document.body.classList.add('loaded');
};   

// ─── Typing animation ─────────────────────────────────────────
const fullText = 'page slipped into the ocean.';
const typedEl = document.getElementById('typed');
const cursorEl = document.getElementById('cursor');
let charIdx = 0;

function typeNextChar() {
  if (charIdx < fullText.length) {
    typedEl.textContent += fullText[charIdx++];
    setTimeout(typeNextChar, 50 + Math.random() * 32);
  } else {
    cursorEl.style.animation = 'none';
    cursorEl.style.opacity = '0';
    const btn = document.getElementById('back-btn');
    if (btn) btn.classList.add('visible');
  }
}
setTimeout(typeNextChar, 750);

// ─── Three.js Scene ──────────────────────────────────────────
const canvas = document.getElementById('ocean-canvas');
const parent = canvas.parentElement;

const W = parent.clientWidth;
const H = parent.clientHeight;

/* Renderer */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

/* Scene */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a2840, 0.048);

/* Camera */
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
camera.position.set(0, 6.5, 14.0);
camera.lookAt(0, 0, -2.0);

// ─── Ocean background / Fog ────────────────────────────────
scene.background = new THREE.Color(0x0a2840);

// ─── Lighting ─────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x0d4a7a, 2.2));

const keyLight = new THREE.DirectionalLight(0xb0ddff, 4.0);
keyLight.position.set(2, 8, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x1565a8, 3.0, 22);
rimLight.position.set(-4, -3, 2);
scene.add(rimLight);

const iceGlow = new THREE.PointLight(0x40c8ff, 5.0, 10);
iceGlow.position.set(0, -1.0, 2.8);
scene.add(iceGlow);


// ─── Animated ocean water surface (Custom GPU Shader) ───────────────────
const waveGeo = new THREE.PlaneGeometry(120, 120, 300, 300);
waveGeo.rotateX(-Math.PI / 2);

const texLoader = new THREE.TextureLoader();
// High quality tileable water normal map
const waterNormal = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg');
waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;

// Interaction Canvas for Mouse Ripples
const interactSize = 512;
const interactCanvas = document.createElement('canvas');
interactCanvas.width = interactSize;
interactCanvas.height = interactSize;
const interactCtx = interactCanvas.getContext('2d');
interactCtx.fillStyle = '#808080'; // 50% gray base
interactCtx.fillRect(0, 0, interactSize, interactSize);
const interactTex = new THREE.CanvasTexture(interactCanvas);

const waveUniforms = {
  uTime: { value: 0 },
  uInteract: { value: interactTex }
};

const waveMat = new THREE.MeshPhongMaterial({
  color: 0x2a7faa,
  specular: new THREE.Color(0x88ccee),
  shininess: 200,
  transparent: true,
  opacity: 0.65,
  side: THREE.DoubleSide,
  normalMap: waterNormal,
  normalScale: new THREE.Vector2(1.2, 1.2),
});

waveMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = waveUniforms.uTime;
  shader.uniforms.uInteract = waveUniforms.uInteract;

  // Safely inject uniforms into the common block
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>
    uniform float uTime;
    uniform sampler2D uInteract;`
  );

  shader.vertexShader = shader.vertexShader.replace(
    '#include <beginnormal_vertex>',
    `
    // First setup the base normal
    vec3 objectNormal = vec3( normal );

    // Calculate physical normal perturbations via partial derivatives
    float dx = 0.0;
    float dz = 0.0;

    float w1 = position.x * 1.1 + position.z * 0.8 + uTime * 1.2;
    dx += 0.3 * 1.1 * cos(w1);
    dz += 0.3 * 0.8 * cos(w1);

    float w2 = position.x * 3.4 + position.z * 2.8 + uTime * 1.8;
    dx += 0.15 * 3.4 * cos(w2);
    dz += 0.15 * 2.8 * cos(w2);

    float w3 = position.x * 1.6 + position.z * 4.5 + uTime * 1.1;
    dx += 0.1 * 1.6 * cos(w3);
    dz += 0.1 * 4.5 * cos(w3);

    objectNormal = normalize( vec3(-dx, 1.0, -dz) );

    #ifdef USE_TANGENT
      vec3 objectTangent = vec3( tangent.xyz );
    #endif
    `
  );

  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    vec3 transformed = vec3( position );
    
    // Large Physical GPU Gerstner Waves
    float wave1 = sin(transformed.x * 1.1 + transformed.z * 0.8 + uTime * 1.2) * 0.3;
    float wave2 = sin(transformed.x * 3.4 + transformed.z * 2.8 + uTime * 1.8) * 0.15;
    float wave3 = sin(transformed.x * 1.6 + transformed.z * 4.5 + uTime * 1.1) * 0.1;
    
    // Mouse Interaction Bump - safely using standard uv
    float interact = 0.0;
    #ifdef USE_UV
      interact = texture2D(uInteract, uv).r; 
    #else
      interact = texture2D(uInteract, vec2(0.5)).r;
    #endif
    float bump = max(0.0, interact - 0.5) * 0.8;
    
    transformed.y += wave1 + wave2 + wave3 + bump;
    `
  );

  // Safely inject fragment uniform
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
    uniform float uTime;`
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <normal_fragment_maps>',
    `
    #ifdef USE_NORMALMAP_OBJECTSPACE
      normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
      #ifdef FLIP_SIDED
        normal = - normal;
      #endif
      #ifdef DOUBLE_SIDED
        normal = normal * faceDirection;
      #endif
      normal = normalize( normalMatrix * normal );
    #elif defined( USE_NORMALMAP_TANGENTSPACE )
      // Dual panning normal maps
      vec2 panUv1 = vNormalMapUv * 6.0 + vec2(uTime * 0.02, uTime * 0.015);
      vec2 panUv2 = vNormalMapUv * 8.0 + vec2(-uTime * 0.015, uTime * 0.02);
      
      vec3 n1 = texture2D(normalMap, panUv1).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D(normalMap, panUv2).xyz * 2.0 - 1.0;
      
      vec3 mapN = normalize(n1 + n2);
      mapN.xy *= normalScale;
      normal = normalize( tbn * mapN );
    #elif defined( USE_BUMPMAP )
      normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
    #endif
    `
  );
};

const waveMesh = new THREE.Mesh(waveGeo, waveMat);
waveMesh.position.set(0, 2.4, -12.0);  
waveMesh.receiveShadow = true;
waveMesh.renderOrder = 10;
scene.add(waveMesh);

// ─── Interactive Raycaster Setup ───────────────────
const ripples = [];
const pointer = new THREE.Vector2(-1, -1);
const raycaster = new THREE.Raycaster();

window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / W) * 2 - 1;
  pointer.y = -(e.clientY / H) * 2 + 1;
  
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(waveMesh);
  if (hits.length > 0) {
    const uv = hits[0].uv;
    ripples.push({
      x: uv.x * interactSize,
      y: (1.0 - uv.y) * interactSize,
      age: 0,
      maxAge: 1.2
    });
  }
});

function drawRipples(dt) {
  // Fade out layer to neutral gray
  interactCtx.globalCompositeOperation = 'source-over';
  interactCtx.fillStyle = 'rgba(128, 128, 128, 0.08)';
  interactCtx.fillRect(0, 0, interactSize, interactSize);
  
  // Draw actively expanding ripples
  interactCtx.globalCompositeOperation = 'lighten';
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.age += dt;
    if (r.age > r.maxAge) {
      ripples.splice(i, 1);
      continue;
    }
    const progress = r.age / r.maxAge;
    const radius = 5 + progress * 35;
    const alpha = 1.0 - (progress * progress); // Ease out quad
    
    const grad = interactCtx.createRadialGradient(r.x, r.y, 0, r.x, r.y, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(1, 'rgba(128, 128, 128, 0)');
    
    interactCtx.fillStyle = grad;
    interactCtx.beginPath();
    interactCtx.arc(r.x, r.y, radius, 0, Math.PI * 2);
    interactCtx.fill();
  }
  interactTex.needsUpdate = true;
}



// ─── Procedural 3D Ice "404" ────────────────────────
const fontLoader = new FontLoader();
const font = await new Promise(resolve => {
  fontLoader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json', resolve);
});

// Load ice surface normal map — gives crystalline, frosted texture
const iceNormal = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg');
iceNormal.wrapS = iceNormal.wrapT = THREE.RepeatWrapping;
iceNormal.repeat.set(3, 3); // Tile tightly for fine crystal detail

// Procedural canvas noise texture baked onto the ice surface
const frostCanvas = document.createElement('canvas');
frostCanvas.width = frostCanvas.height = 512;
const frostCtx = frostCanvas.getContext('2d');
// Base icy turquoise
frostCtx.fillStyle = '#aae4ff';
frostCtx.fillRect(0, 0, 512, 512);
// Overlay irregular frosted patches
for (let i = 0; i < 800; i++) {
  const x = Math.random() * 512;
  const y = Math.random() * 512;
  const r = 2 + Math.random() * 18;
  const alpha = 0.05 + Math.random() * 0.25;
  const grad = frostCtx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
  grad.addColorStop(1, `rgba(180,230,255,0)`);
  frostCtx.fillStyle = grad;
  frostCtx.beginPath();
  frostCtx.arc(x, y, r, 0, Math.PI * 2);
  frostCtx.fill();
}
// Crack lines
frostCtx.strokeStyle = 'rgba(200,240,255,0.35)';
frostCtx.lineWidth = 1;
for (let i = 0; i < 60; i++) {
  frostCtx.beginPath();
  frostCtx.moveTo(Math.random() * 512, Math.random() * 512);
  frostCtx.lineTo(Math.random() * 512, Math.random() * 512);
  frostCtx.stroke();
}
const frostTex = new THREE.CanvasTexture(frostCanvas);
frostTex.wrapS = frostTex.wrapT = THREE.RepeatWrapping;
frostTex.repeat.set(2, 2);

const iceMat = new THREE.MeshPhysicalMaterial({
  color: 0xddf8ff,           // Icy white-blue tint
  map: frostTex,             // Frosted surface color map
  normalMap: iceNormal,      // Crystal facet normal detail
  normalScale: new THREE.Vector2(0.6, 0.6),
  transmission: 0.7,         // Semi-transparent like solid ice
  opacity: 1,
  metalness: 0.05,
  roughness: 0.25,           // Slightly frosted surface
  ior: 1.31,                 // True ice refraction index
  thickness: 3.0,            // Thicker = more internal refraction
  specularIntensity: 1.5,
  specularColor: new THREE.Color(0xaaf0ff),
  clearcoat: 1.0,            // Wet film on exterior
  clearcoatRoughness: 0.1,
  emissive: new THREE.Color(0x004466),
  emissiveIntensity: 0.08,   // Very subtle inner glow
});

const textOptions = {
  font: font,
  size: 3.5,
  height: 0.8,
  curveSegments: 12,
  bevelEnabled: true,
  bevelThickness: 0.1,
  bevelSize: 0.05,
  bevelOffset: 0,
  bevelSegments: 3
};

const geo4_1 = new TextGeometry('4', textOptions);
const geo0   = new TextGeometry('0', textOptions);
const geo4_2 = new TextGeometry('4', textOptions);

[geo4_1, geo0, geo4_2].forEach(g => g.computeBoundingBox());

function createCharGroup(geo, xOffset) {
  const mesh = new THREE.Mesh(geo, iceMat);
  // Center mesh locally
  const cx = -0.5 * (geo.boundingBox.max.x - geo.boundingBox.min.x);
  const cy = -0.5 * (geo.boundingBox.max.y - geo.boundingBox.min.y);
  const cz = -0.5 * (geo.boundingBox.max.z - geo.boundingBox.min.z);
  mesh.position.set(cx, cy, cz);
  
  const group = new THREE.Group();
  group.add(mesh);
  
  group.position.x = xOffset;
  // Position deeply under the camera view
  group.position.z = -1.5; 
  
  scene.add(group);
  return group;
}

const spacing = 3.5; 
const charGroups = [
  createCharGroup(geo4_1, -spacing),
  createCharGroup(geo0,   0), 
  createCharGroup(geo4_2, spacing)
];

// ─── Bubbles ──────────────────────────────────────────────────
const bubbles = [];
const bGeo = new THREE.SphereGeometry(1, 10, 10);
const bMat = new THREE.MeshPhongMaterial({
  color: 0x99ddff, transparent: true, opacity: 0.38, shininess: 300, specular: 0xffffff,
});

for (let i = 0; i < 50; i++) {
  const s = 0.015 + Math.random() * 0.055;
  const mesh = new THREE.Mesh(bGeo, bMat.clone());
  mesh.scale.setScalar(s);
  mesh.position.set(
    (Math.random() - 0.5) * 9,
    -3 - Math.random() * 2.5,
    (Math.random() - 0.5) * 4 - 1,
  );
  scene.add(mesh);
  bubbles.push({
    mesh,
    speed: 0.007 + Math.random() * 0.02,
    startY: mesh.position.y,
    wobble: Math.random() * Math.PI * 2,
    wobbleS: 0.5 + Math.random() * 1.5,
  });
}

// ─── Floating dust particles ──────────────────────────────────
{
  const count = 300;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 7 - 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo,
    new THREE.PointsMaterial({ color: 0x70c8e8, size: 0.035, transparent: true, opacity: 0.55 })
  ));
}

// ─── Animation loop ───────────────────────────────────────────
let t = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.016;

  // Floating 3D Text logic
  charGroups.forEach((group, index) => {
    // 1. Calculate wave height at this exact position
    // Geometry was constructed natively as a plane and rotated X by -PI/2.
    // So its local Z corresponds to World Z. 
    // And since it was moved 12 units deep (waveMesh.position.z = -12),
    // local Z = world Z + 12.0
    const lx = group.position.x;
    const lz = group.position.z + 12.0;

    let waveY = 0;
    waveY += Math.sin(lx * 1.1 + lz * 0.8 + t * 1.2) * 0.3;
    waveY += Math.sin(lx * 3.4 + lz * 2.8 + t * 1.8) * 0.15;
    waveY += Math.sin(lx * 1.6 + lz * 4.5 + t * 1.1) * 0.1;
    
    // Wave surface base
    const surfaceY = 2.4;
    
    // Position slightly submerged in the exact wave height
    group.position.y = surfaceY + waveY - 0.4;

    // Organic Pitch/Roll wobble
    group.rotation.x = Math.sin(t * 1.5 + index) * 0.1;
    group.rotation.z = Math.cos(t * 1.2 + index) * 0.1;
  });

  // Bubbles rise
  bubbles.forEach(b => {
    b.mesh.position.y += b.speed;
    b.wobble += b.wobbleS * 0.016;
    b.mesh.position.x += Math.sin(b.wobble) * 0.003;
    if (b.mesh.position.y > 2.2) {
      b.mesh.position.y = b.startY;
      b.mesh.position.x = (Math.random() - 0.5) * 9;
    }
  });

  // GPU Ocean waves + interactive ripples update
  waveUniforms.uTime.value = t;
  drawRipples(0.016);


  // Ice glow breathe
  iceGlow.intensity = 5.0 + Math.sin(t * 1.3) * 1.5;

  // Rim light orbit
  rimLight.position.x = -4 + Math.sin(t * 0.28) * 2;
  rimLight.position.z = 2 + Math.cos(t * 0.28) * 1.5;

  renderer.render(scene, camera);
}
animate();

// ─── Resize ───────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const nW = parent.clientWidth;
  const nH = parent.clientHeight;
  camera.aspect = nW / nH;
  camera.updateProjectionMatrix();
  renderer.setSize(nW, nH);
});
