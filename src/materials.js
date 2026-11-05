// Material Preview style look.
//
// Colors + roughness + metalness tuned live in the viewer with the material tuner.
// These values are the user's locked-in choices.
import * as THREE from 'three';

const MATERIAL_OVERRIDES = {
  // Steel / aluminium
  'Steel Dark':         { color: 0x141414, roughness: 0.55, metalness: 0.60 },
  'Alu Dark':           { color: 0x1c1c1c, roughness: 0.40, metalness: 0.75 },

  // Paints
  'Black':              { color: 0x1a1a19, roughness: 0.55, metalness: 0.05 },
  'Cream White':        { color: 0xdfdfdd, roughness: 0.85, metalness: 0.00 },
  'Cream White Sheen':  { color: 0xd7d7ce, roughness: 0.55, metalness: 0.05 },

  // Concrete
  'Grey (beton)':       { color: 0x343232, roughness: 1.00, metalness: 0.00 },

  // Glass — transparent
  'GlassMat':           { color: 0xb2cde1, roughness: 0.05, metalness: 0.00, transparent: true, opacity: 0.20, depthWrite: false, side: THREE.DoubleSide },
  'GlassMatBlack':      { color: 0x111213, roughness: 0.10, metalness: 0.00, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide },

  // Woods
  'Wood Colour Light':         { color: 0xb68e77, roughness: 0.82, metalness: 0.00 },
  'Wood Colour Light B':       { color: 0xb68e77, roughness: 0.82, metalness: 0.00 },
  'Wood Colour Light C':       { color: 0xb68e77, roughness: 0.82, metalness: 0.00 },
  'Wood Colour Light D':       { color: 0xb68e77, roughness: 0.82, metalness: 0.00 },
  'Wood Colour Light Raw':     { color: 0x9c7c68, roughness: 0.82, metalness: 0.00 },
  'Wood Colour Light Rotated': { color: 0x9c7c68, roughness: 0.82, metalness: 0.00 },
  'Wood Colour Darker Raw':    { color: 0xb68e77, roughness: 0.82, metalness: 0.00 },
  'Wood Colour Middle':        { color: 0x8d5f42, roughness: 0.82, metalness: 0.00 },
  'Wood Colour Little Darker': { color: 0x785840, roughness: 0.85, metalness: 0.00 },
  'Wood Colour Old':           { color: 0x785840, roughness: 0.85, metalness: 0.00 },
  'Wood Colour Old rotated':   { color: 0x785840, roughness: 0.85, metalness: 0.00 },
  'Wood Colour Raw Plate':     { color: 0xa08879, roughness: 0.82, metalness: 0.00 },
  'Dark Brown Base':           { color: 0x785840, roughness: 0.85, metalness: 0.00 },
};

export function applyMaterialLook(root) {
  const applied = new Set();
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (applied.has(m.uuid)) continue;
      applied.add(m.uuid);

      // Default: make sure nothing is transparent unless we say so.
      // DoubleSide so negative-scaled (mirrored) Blender objects render both faces —
      // 302 objects in this file use scale.y = -1 which three.js cannot auto-correct.
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
      m.side = THREE.DoubleSide;

      const override = MATERIAL_OVERRIDES[m.name];
      if (override) {
        if (override.color !== undefined) m.color = new THREE.Color(override.color);
        if (override.roughness !== undefined) m.roughness = override.roughness;
        if (override.metalness !== undefined) m.metalness = override.metalness;
        if (override.transparent) m.transparent = true;
        if (override.opacity !== undefined) m.opacity = override.opacity;
        if (override.depthWrite !== undefined) m.depthWrite = override.depthWrite;
        if (override.side !== undefined) m.side = override.side;
      }
    }
  });
}
