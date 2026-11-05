// Live material tuner: color + roughness + metalness per material.
// Opens as a floating panel on the left so the render overlay stays visible on the right.
// Each row has copy / paste buttons for quickly cloning one material's values into another;
// the header "Copy JSON" dumps the whole set.
//
// A single "Background" row at the top drives the scene's clear color (scene.background).
// All changes (materials and background) revert on reload — they're session-only tuning
// until you copy the JSON and paste it into materials.js.
import * as THREE from 'three';

// Group materials by name (glTF often imports multiple instances with the same name)
// so one UI row drives every instance.
function materialsByName(root) {
  const byName = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m.name) continue;
      if (!byName.has(m.name)) byName.set(m.name, []);
      byName.get(m.name).push(m);
    }
  });
  // Sort entries alphabetically
  return Array.from(byName.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function hexOf(color) {
  return '#' + color.getHexString();
}

export function buildTuner(sceneRoot, scene) {
  // Wrapper panel
  const panel = document.createElement('aside');
  panel.id = 'tuner';
  panel.className = 'tuner hidden';
  panel.innerHTML = `
    <header class="tuner-head">
      <strong>Material tuner</strong>
      <span id="tuner-clipboard" class="tuner-clipboard"></span>
      <button id="tuner-copy" class="tuner-btn" title="Copy JSON">Copy JSON</button>
      <button id="tuner-close" class="tuner-btn" aria-label="Close">×</button>
    </header>
    <div id="tuner-list" class="tuner-list"></div>
  `;
  document.body.appendChild(panel);

  const list = panel.querySelector('#tuner-list');

  // ---- Background color row --------------------------------------------------------------
  // scene.background is a THREE.Color here; drive it with a color input. Revert = reload.
  if (scene && scene.background && scene.background.isColor) {
    const bgRow = document.createElement('div');
    bgRow.className = 'tuner-row tuner-row-bg';
    bgRow.innerHTML = `
      <div class="tuner-name"><strong>Background</strong></div>
      <input type="color" class="tuner-color" value="${hexOf(scene.background)}" />
    `;
    const bgColor = bgRow.querySelector('.tuner-color');
    bgColor.addEventListener('input', (e) => {
      scene.background.set(e.target.value);
    });
    list.appendChild(bgRow);
  }

  const groups = materialsByName(sceneRoot);

  // Shared clipboard for row-level copy/paste
  let clipboard = null;
  const clipboardLabel = panel.querySelector('#tuner-clipboard');
  const updateClipboardLabel = () => {
    if (clipboardLabel) {
      clipboardLabel.textContent = clipboard ? `Clipboard: ${clipboard.from}` : '';
    }
  };

  const state = {};  // {matName: {color, roughness, metalness}}
  const rowApis = {}; // {matName: {setColor, setRough, setMetal}}
  for (const [name, instances] of groups) {
    const first = instances[0];
    state[name] = {
      color: hexOf(first.color),
      roughness: first.roughness ?? 0.5,
      metalness: first.metalness ?? 0.0,
    };
    const row = document.createElement('div');
    row.className = 'tuner-row';
    const safe = name.replace(/"/g, '&quot;');
    row.innerHTML = `
      <div class="tuner-name" title="${safe} (${instances.length})">${safe}</div>
      <input type="color" class="tuner-color" value="${state[name].color}" />
      <label class="tuner-slider" title="Roughness">
        <span>R</span>
        <input type="range" min="0" max="1" step="0.02" value="${state[name].roughness}" class="rough" />
        <span class="val">${state[name].roughness.toFixed(2)}</span>
      </label>
      <label class="tuner-slider" title="Metalness">
        <span>M</span>
        <input type="range" min="0" max="1" step="0.02" value="${state[name].metalness}" class="metal" />
        <span class="val">${state[name].metalness.toFixed(2)}</span>
      </label>
      <button class="tuner-mini copy-btn" title="Copy this material">C</button>
      <button class="tuner-mini paste-btn" title="Paste into this material">P</button>
    `;
    const colorInput = row.querySelector('.tuner-color');
    const roughInput = row.querySelector('.rough');
    const metalInput = row.querySelector('.metal');
    const roughVal = row.querySelectorAll('.val')[0];
    const metalVal = row.querySelectorAll('.val')[1];
    const copyBtn = row.querySelector('.copy-btn');
    const pasteBtn = row.querySelector('.paste-btn');

    const setColor = (hex) => {
      colorInput.value = hex;
      for (const m of instances) m.color.set(hex);
      state[name].color = hex;
    };
    const setRough = (v) => {
      v = Math.max(0, Math.min(1, v));
      roughInput.value = v;
      roughVal.textContent = v.toFixed(2);
      for (const m of instances) m.roughness = v;
      state[name].roughness = v;
    };
    const setMetal = (v) => {
      v = Math.max(0, Math.min(1, v));
      metalInput.value = v;
      metalVal.textContent = v.toFixed(2);
      for (const m of instances) m.metalness = v;
      state[name].metalness = v;
    };

    rowApis[name] = { setColor, setRough, setMetal };

    colorInput.addEventListener('input', (e) => setColor(e.target.value));
    roughInput.addEventListener('input', (e) => setRough(parseFloat(e.target.value)));
    metalInput.addEventListener('input', (e) => setMetal(parseFloat(e.target.value)));

    copyBtn.addEventListener('click', () => {
      clipboard = {
        from: name,
        color: state[name].color,
        roughness: state[name].roughness,
        metalness: state[name].metalness,
      };
      updateClipboardLabel();
      copyBtn.textContent = '✓';
      setTimeout(() => { copyBtn.textContent = 'C'; }, 700);
    });
    pasteBtn.addEventListener('click', () => {
      if (!clipboard) return;
      setColor(clipboard.color);
      setRough(clipboard.roughness);
      setMetal(clipboard.metalness);
      pasteBtn.textContent = '✓';
      setTimeout(() => { pasteBtn.textContent = 'P'; }, 700);
    });

    list.appendChild(row);
  }

  // Copy JSON of current state to clipboard
  panel.querySelector('#tuner-copy').addEventListener('click', async () => {
    const json = JSON.stringify(state, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      const btn = panel.querySelector('#tuner-copy');
      const orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    } catch {
      console.log(json);
      alert('Copy failed — JSON logged to console');
    }
  });
  panel.querySelector('#tuner-close').addEventListener('click', () => panel.classList.add('hidden'));

  return {
    panel,
    open() { panel.classList.remove('hidden'); },
    close() { panel.classList.add('hidden'); },
    toggle() { panel.classList.toggle('hidden'); },
  };
}
