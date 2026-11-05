// Camera list sidebar + fly-to + render overlay (no 3D markers).
//
// Grouping follows the Blender camera subcollections:
//   Plans   → E-Plan, M-Plan, Both-Plan     (ortho top-down)
//   E Exterior / E Interior                 (perspective)
//   M Exterior / M Interior                 (perspective)
//   Both                                    (perspective)
//
// Render files live in /renders/ and are named 20260909_NNNN.jpg (base) or
// 20260910_Green_NNNN.jpg. The RENDER_MAP below pairs camera name → NNNN.
// Any mapping entry that's wrong can be edited inline — it's a plain object.
import { tweenVec3 } from './anim.js';
import { cameraMatchesBuilding } from './building.js';

// Locked-in mapping (confirmed by user via in-app cycling).
export const RENDER_MAP = {
  // M Exterior
  'M-Exterior-01': '0001',
  'M-Exterior-02': '0003',
  'M-Exterior-03': '0002',
  'M-Exterior-04': '0004',
  'M-Exterior-05': '0005',
  'M-Exterior-06': '0007',
  'M-Exterior-07': '0010',

  // M Interior
  'M-Interior-01': '0011',
  'M-Interior-02': '0012',
  'M-Interior-03': '0013',
  'M-Interior-04': '0014',
  'M-Interior-05': '0015',
  'M-Interior-06': '0016',
  'M-Interior-07': '0017',

  // E Exterior
  'E-Exterior-01': '0021',
  'E-Exterior-02': '0022',
  'E-Exterior-03': '0023',
  'E-Exterior-04': '0024',
  'E-Exterior-05': '0025',
  'E-Exterior-06': '0026',
  'E-Exterior-07': '0027',
  'E-Exterior-08': '0028',

  // E Interior
  'E-Interior-01': '0029',
  'E-Interior-02': '0030',
  'E-Interior-03': '0031',
  'E-Interior-04': '0032',
  'E-Interior-05': '0033',
  'E-Interior-06': '0034',

  // Both
  'Both-01': '0035',
  'Both-02': '0036',

  // Plans
  'Both-Plan': '0018',
  'E-Plan':    '0020',
  'M-Plan':    '0019',
};

// Order mirrors the site plan: M on the left, E on the right.
export const CAMERA_GROUPS = [
  { label: 'M · Exterior', match: (n) => n.startsWith('M-Exterior-') },
  { label: 'M · Interior', match: (n) => n.startsWith('M-Interior-') },
  { label: 'E · Exterior', match: (n) => n.startsWith('E-Exterior-') },
  { label: 'E · Interior', match: (n) => n.startsWith('E-Interior-') },
  { label: 'Both',         match: (n) => n.startsWith('Both-') && !n.endsWith('-Plan') },
  { label: 'Plans',        match: (n) => n.endsWith('-Plan') },
];

// One-shot cleanup: wipe any leftover per-device overrides from the earlier cycle UI
// so the hardcoded RENDER_MAP is the single source of truth across devices.
try { localStorage.removeItem('klingel.renderMap.v1'); } catch {}

export function getRenderNumber(cameraName) {
  return RENDER_MAP[cameraName] || null;
}

export function renderUrlForNumber(n, greenSet) {
  if (!n) return null;
  return greenSet
    ? `/renders/20260910_Green_${n}.jpg`
    : `/renders/20260909_${n}.jpg`;
}

export function buildCameraList(container, gltfCameras, building, onPick) {
  container.innerHTML = '';

  for (const group of CAMERA_GROUPS) {
    const members = gltfCameras
      .filter((c) => group.match(c.name) && cameraMatchesBuilding(c.name, building))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (members.length === 0) continue;

    const g = document.createElement('div');
    g.className = 'cam-group';
    g.dataset.group = group.label.replace(/\s+·\s+/g, '-').toLowerCase();
    const h = document.createElement('div');
    h.className = 'cam-group-head';
    h.textContent = group.label;
    g.appendChild(h);

    const chips = document.createElement('div');
    chips.className = 'cam-chips';
    for (const cam of members) {
      const b = document.createElement('button');
      b.className = 'cam-chip';
      // In Plans group, keep full names (E-Plan / M-Plan / Both-Plan).
      // In other groups, strip the shared prefix for a tighter look.
      let label = cam.name;
      if (group.label !== 'Plans') {
        label = cam.name.replace(/^(E-Exterior-|E-Interior-|M-Exterior-|M-Interior-|Both-)/, '');
      }
      b.textContent = label;
      b.title = cam.name;
      b.dataset.cameraName = cam.name;
      b.addEventListener('click', () => {
        container.querySelectorAll('.cam-chip.active').forEach((el) => el.classList.remove('active'));
        b.classList.add('active');
        onPick(cam);
      });
      chips.appendChild(b);
    }
    g.appendChild(chips);
    container.appendChild(g);
  }
}

// Fly the viewer's PerspectiveCamera to match a glTF camera's position + orientation,
// AND copy its FOV, near, far so the framing matches the original Blender render as closely
// as possible (fixes "camera clipping through walls" when the Blender cam had clip_start
// pushed out past a wall).
export function flyToGltfCamera({ viewerCamera, controls, gltfCam, duration = 900 }) {
  const Vec = gltfCam.position.constructor;
  const Quat = viewerCamera.quaternion.constructor;

  const toPos = gltfCam.getWorldPosition(new Vec());
  const toQuat = gltfCam.getWorldQuaternion(new Quat());
  const fwd = new Vec(0, 0, -1).applyQuaternion(toQuat);
  const toTarget = toPos.clone().add(fwd.multiplyScalar(5));

  // Sync projection to the glTF camera
  if (gltfCam.isPerspectiveCamera) {
    viewerCamera.fov = gltfCam.fov;
    viewerCamera.near = Math.max(gltfCam.near || 0.1, 0.01);
    // Keep a generous far so distant geometry doesn't disappear
    viewerCamera.far = Math.max(gltfCam.far || 500, 500);
    viewerCamera.updateProjectionMatrix();
  }

  tweenVec3({ obj: viewerCamera.position, to: toPos, duration });
  tweenVec3({ obj: controls.target, to: toTarget, duration, onDone: () => controls.update() });
}
