import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { applyMaterialLook } from './materials.js';
import { buildModeToggle } from './modes.js';
import { buildTuner } from './tuner.js';
import { buildCameraList, flyToGltfCamera, renderUrlForNumber, getRenderNumber } from './cameras.js';
import { buildBuildingToggle } from './building.js';
import { buildConstructionPanel, hiddenConstructionCollections } from './construction.js';
import { applyVisibility } from './visibility.js';

// ---------- Renderer ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.1;

// ---------- Scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1f232b);

// ---------- Cameras ----------
const perspCam = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
perspCam.position.set(20, 15, 25);
const orthoCam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 500);
orthoCam.position.set(0, 50, 0);
orthoCam.up.set(-1, 0, 0);
scene.add(orthoCam);
let activeCam = perspCam;

// ---------- Environment + Lights ----------
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 1.0;

const hemi = new THREE.HemisphereLight(0xfff5e0, 0x404040, 0.4);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffeccb, 0.7);
dir.position.set(15, 25, 10);
scene.add(dir);

// ---------- Controls ----------
const controls = new OrbitControls(perspCam, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1, 0);

// ---------- Loader ----------
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

const loadingEl = document.getElementById('loading');
const barEl = document.getElementById('loading-bar-fill');

let sceneRoot = null;
let gltfCameras = [];
let currentMode = 'rendered';
let currentBuilding = 'both';
let greenMode = true;
let currentCamName = null;
let planActive = false;

const cameraPanelEl = document.getElementById('camera-panel');
const constructionPanelEl = document.getElementById('construction-panel');

loader.load(
  '/model.glb',
  (gltf) => {
    sceneRoot = gltf.scene;
    gltfCameras = gltf.cameras || [];

    // Drop the Blender render-helper meshes (Extras_Floorplane etc.) — they are sized for
    // Blender renders and would dwarf the actual buildings.
    const toRemove = [];
    sceneRoot.traverse((o) => {
      if (o.isMesh && o.name && o.name.startsWith('Extras_')) toRemove.push(o);
    });
    for (const o of toRemove) o.parent && o.parent.remove(o);

    scene.add(sceneRoot);

    applyMaterialLook(sceneRoot);
    refreshVisibility();
    ensureGroundPlane();
    applyGroundFor(currentMode);

    // Tuner — floating panel; toggled by the settings cog on the right of the bottom panel.
    const tuner = buildTuner(sceneRoot, scene);
    const tunerToggle = document.getElementById('tuner-toggle');
    tunerToggle.addEventListener('click', () => {
      tuner.toggle();
      tunerToggle.classList.toggle('active', !tuner.panel.classList.contains('hidden'));
    });

    buildBuildingToggle(document.getElementById('building-panel'), currentBuilding, (b) => {
      currentBuilding = b;
      leavePlan();
      // The active camera might belong to the now-hidden building — close the render overlay.
      closeRender();
      rebuildCameras();
      rebuildConstruction();
      refreshVisibility();
    });

    buildModeToggle(document.getElementById('mode-panel'), currentMode, (m) => {
      currentMode = m;
      leavePlan();
      setContentPane(m);
      refreshVisibility();
      applyGroundFor(m);
    });

    rebuildCameras();
    rebuildConstruction();
    setContentPane(currentMode);

    fitToObject(sceneRoot);
    loadingEl.classList.add('hidden');
  },
  (xhr) => {
    if (xhr.lengthComputable) {
      barEl.style.width = `${(xhr.loaded / xhr.total) * 100}%`;
    }
  },
  (err) => {
    console.error('glTF load error', err);
    loadingEl.querySelector('.loading-text').textContent = 'Failed to load model (see console).';
  }
);

function rebuildCameras() {
  buildCameraList(cameraPanelEl, gltfCameras, currentBuilding, (gltfCam) => goToCamera(gltfCam));
}
function rebuildConstruction() {
  buildConstructionPanel(constructionPanelEl, currentBuilding, () => refreshVisibility());
}
function setContentPane(mode) {
  // Only one of the two panes is shown at a time — cameras in Rendered, construction in Construction.
  cameraPanelEl.classList.toggle('hidden', mode !== 'rendered');
  constructionPanelEl.classList.toggle('hidden', mode !== 'construction');
}
function refreshVisibility() {
  const hiddenCols = currentMode === 'construction'
    ? hiddenConstructionCollections(currentBuilding)
    : null;
  applyVisibility({
    sceneRoot,
    mode: currentMode,
    building: currentBuilding,
    hiddenConstructionCols: hiddenCols,
  });
  // Plan mode hides roofs on top of the base mode; preserve that.
  if (planActive) setRoofsVisible(false);
}

// ---------- Mode-dependent ground plane ----------
let groundMesh = null;
function ensureGroundPlane() {
  if (groundMesh) return;
  const geo = new THREE.PlaneGeometry(60, 60);
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  // Share the scene.background Color instance so the plane repaints whenever the user
  // changes the background in the tuner — no extra wiring needed.
  mat.color = scene.background;
  groundMesh = new THREE.Mesh(geo, mat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.09;
  groundMesh.name = '__groundPlane';
  groundMesh.renderOrder = -1;
  scene.add(groundMesh);
}
function applyGroundFor(mode) {
  if (groundMesh) groundMesh.visible = (mode === 'rendered');
}

// ---------- Plan view handling ----------
function findByName(name) {
  let found = null;
  sceneRoot.traverse((o) => { if (!found && o.name === name) found = o; });
  return found;
}
function setBranchVisibility(obj, visible) {
  if (obj) obj.traverse((o) => { o.visible = visible; });
}
function setRoofsVisible(visible) {
  setBranchVisibility(findByName('Roof-E'), visible);
  setBranchVisibility(findByName('Roof-M'), visible);
}

function enterPlan(gltfCam) {
  planActive = true;
  setRoofsVisible(false);

  const pos = gltfCam.getWorldPosition(new THREE.Vector3());
  const targetPos = new THREE.Vector3(pos.x, 0, pos.z);
  orthoCam.position.set(pos.x, Math.max(pos.y, 30), pos.z);

  const halfW = gltfCam.isOrthographicCamera
    ? Math.max(gltfCam.right - gltfCam.left, 10) / 2
    : 12;
  const aspect = window.innerWidth / window.innerHeight;
  orthoCam.left = -halfW * aspect;
  orthoCam.right = halfW * aspect;
  orthoCam.top = halfW;
  orthoCam.bottom = -halfW;
  orthoCam.near = 0.1;
  orthoCam.far = 500;
  orthoCam.up.set(-1, 0, 0);
  orthoCam.lookAt(targetPos);
  orthoCam.updateProjectionMatrix();

  activeCam = orthoCam;
  controls.object = activeCam;
  controls.target.copy(targetPos);
  controls.enableRotate = false;
  controls.update();
}

function leavePlan() {
  if (!planActive) return;
  planActive = false;
  activeCam = perspCam;
  controls.object = activeCam;
  controls.enableRotate = true;
  controls.update();
  refreshVisibility();
  applyGroundFor(currentMode);
}

function goToCamera(gltfCam) {
  const isPlan = gltfCam.name.endsWith('-Plan');
  if (isPlan) {
    leavePlan();
    enterPlan(gltfCam);
  } else {
    if (planActive) leavePlan();
    flyToGltfCamera({ viewerCamera: perspCam, controls, gltfCam });
  }
  openRender(gltfCam.name);
}

// ---------- Fit camera to object ----------
function fitToObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.6;
  perspCam.position.copy(center).add(new THREE.Vector3(dist, dist * 0.6, dist));
  perspCam.near = Math.max(maxDim / 1000, 0.01);
  perspCam.far = Math.max(maxDim * 20, 500);
  perspCam.updateProjectionMatrix();
  controls.update();
}

// ---------- Render overlay ----------
const renderPanel = document.getElementById('render-panel');
const renderImg = document.getElementById('render-img');
const renderTitle = document.getElementById('render-title');
const greenToggle = document.getElementById('green-toggle');
const renderMissing = document.getElementById('render-missing');
greenToggle.checked = greenMode;
greenToggle.addEventListener('change', (e) => {
  greenMode = e.target.checked;
  if (currentCamName) refreshRender();
});
document.getElementById('render-close').addEventListener('click', closeRender);
document.getElementById('render-fullscreen').addEventListener('click', () => {
  renderPanel.classList.toggle('fullscreen');
});
controls.addEventListener('start', () => {
  if (!renderPanel.classList.contains('hidden')) renderPanel.classList.add('faded');
});

function openRender(name) {
  currentCamName = name;
  renderTitle.textContent = name;
  refreshRender();
  renderPanel.classList.remove('hidden', 'faded');
}
function closeRender() {
  renderPanel.classList.add('hidden');
  currentCamName = null;
}
function refreshRender() {
  const n = getRenderNumber(currentCamName);
  const url = n ? renderUrlForNumber(n, greenMode) : null;
  if (url) {
    renderImg.src = url;
    renderImg.style.display = 'block';
    renderMissing.style.display = 'none';
  } else {
    renderImg.removeAttribute('src');
    renderImg.style.display = 'none';
    renderMissing.style.display = 'block';
    renderMissing.textContent = 'No render for this view.';
  }
}

// ---------- Picking (click to identify a piece) ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const infoBar = document.getElementById('info-bar');
const infoMain = document.getElementById('info-main');
document.getElementById('info-close').addEventListener('click', () => infoBar.classList.add('hidden'));

function screenToNDC(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}
function onPick(clientX, clientY) {
  if (!sceneRoot) return;
  screenToNDC(clientX, clientY);
  raycaster.setFromCamera(pointer, activeCam);
  const hits = raycaster.intersectObject(sceneRoot, true);
  const hit = hits.find((h) => h.object.isMesh && h.object.visible);
  if (!hit) {
    infoBar.classList.add('hidden');
    return;
  }
  const obj = hit.object;
  const path = [];
  for (let o = obj; o; o = o.parent) {
    if (o.name) path.unshift(o.name);
    if (!o.parent) break;
  }
  const material = obj.material && obj.material.name ? obj.material.name : '—';
  infoMain.innerHTML = `
    <div class="path">${path.slice(0, -1).join(' / ')}</div>
    <div class="name">${obj.name || '(unnamed)'}</div>
    <div class="meta">Material: ${material}</div>
  `;
  infoBar.classList.remove('hidden');
}

let downX = 0, downY = 0, downT = 0;
canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); });
canvas.addEventListener('pointerup', (e) => {
  const dx = e.clientX - downX, dy = e.clientY - downY, dt = performance.now() - downT;
  if (Math.hypot(dx, dy) < 5 && dt < 400) onPick(e.clientX, e.clientY);
});

// ---------- Side-panel open/close ----------
const sidePanel = document.getElementById('side-panel');
const panelToggle = document.getElementById('panel-toggle');
function setPanelOpen(open) {
  sidePanel.classList.toggle('closed', !open);
  panelToggle.classList.toggle('visible', !open);
}
panelToggle.addEventListener('click', () => setPanelOpen(true));
document.getElementById('panel-close').addEventListener('click', () => setPanelOpen(false));

// ---------- Resize ----------
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  perspCam.aspect = w / h;
  perspCam.updateProjectionMatrix();
  const halfH = (orthoCam.top - orthoCam.bottom) / 2;
  const aspect = w / h;
  orthoCam.left = -halfH * aspect;
  orthoCam.right = halfH * aspect;
  orthoCam.updateProjectionMatrix();
  renderer.setSize(w, h, false);
});

// ---------- Loop ----------
function tick() {
  controls.update();
  renderer.render(scene, activeCam);
  requestAnimationFrame(tick);
}
tick();
