// Construction steps panel: five main steps (Main Structure, Floor, Wall Structure, Frames,
// Ceiling) that toggle visibility of specific Blender collections while in Construction mode.
//
// In 'both' building mode: five step-level toggles, each controlling the matching collections
//   for BOTH buildings at once (no sub-chips).
// In 'M' or 'E' building mode: each step still has a header toggle; where that building has
//   sub-steps (Wall Structure, Frames, Ceiling) a row of sub-chips appears under the header
//   and the header becomes an aggregate control (click = sync all subs to the opposite).
// A single "All" toggle at the front flips every currently-visible toggle on/off together.
//
// Collection names use underscores (not spaces) because glTF export normalizes Blender's
// "Finn-joist 740x200-M" to "Finn-joist_740x200-M".
// Blender Foundation-M / Foundation-E are never hidden here — the modes.js layer keeps those
// visible in Construction mode no matter what.

export const STEPS = [
  {
    key: 'main',
    label: 'Main Structure',
    collections: { M: ['Hoofdconstructie-M'], E: ['Hoofdconstructie-E'] },
    subSteps: { M: [], E: [] },
  },
  {
    key: 'floor',
    label: 'Floor',
    collections: { M: ['Boxes-M'], E: ['Boxes-E'] },
    subSteps: { M: [], E: [] },
  },
  {
    key: 'wall',
    label: 'Wall Structure',
    collections: { M: ['WallStructure-M'], E: ['WallStructure-E'] },
    subSteps: {
      M: [
        { key: 'wall-m-vert',   label: 'Finn-Joist Vertical', collections: ['Finn-joist_2758x200-M'] },
        { key: 'wall-m-spacer', label: 'Spacers',             collections: ['Finn-joist_740x200-M'] },
      ],
      E: [
        { key: 'wall-e-vert',   label: 'Finn-Joist Vertical', collections: ['Finn-joist_2758x200-E'] },
        { key: 'wall-e-spacer', label: 'Spacers',             collections: ['Finn-joist_2028x200-E'] },
      ],
    },
  },
  {
    key: 'frames',
    label: 'Frames',
    collections: { M: ['Frames-M'], E: ['Frames-E'] },
    subSteps: {
      M: [
        { key: 'frames-m-doors',    label: 'Doors',           collections: ['Doorframe_2220x1480-M', 'Doorframe_2220x1000-M'] },
        { key: 'frames-m-w740x740', label: 'Windows 740x740', collections: ['WindowFrame_740x740-M'] },
        { key: 'frames-m-w740x420', label: 'Windows 740x420', collections: ['WindowFrame_740x420-M'] },
        { key: 'frames-m-w480x740', label: 'Windows 480x740', collections: ['WindowFrame_480x740-M'] },
        { key: 'frames-m-w480x680', label: 'Windows 480x680', collections: ['WindowFrame_480x680-M'] },
      ],
      E: [
        { key: 'frames-e-doors',     label: 'Doors',            collections: ['Doorframe_2220x1438-E'] },
        { key: 'frames-e-w740x740',  label: 'Windows 740x740',  collections: ['WindowFrame_740x740-E'] },
        { key: 'frames-e-w740x220',  label: 'Windows 740x220',  collections: ['WindowFrame_740x220-E'] },
        { key: 'frames-e-w480x740',  label: 'Windows 480x740',  collections: ['WindowFrame_480x740-E'] },
        { key: 'frames-e-w480x680',  label: 'Windows 480x680',  collections: ['WindowFrame_480x680-E'] },
        { key: 'frames-e-w648x1410', label: 'Windows 648x1410', collections: ['WindowFrame_648x1410-E'] },
      ],
    },
  },
  {
    key: 'ceiling',
    label: 'Ceiling',
    collections: { M: ['CeilingStructure-M', 'Dakspant-M'], E: ['CeilingStructure-E', 'Dakspant-E'] },
    subSteps: {
      M: [
        { key: 'ceil-m-horiz',  label: 'Finn-Joist Horizontal', collections: ['Finn-joist_306x2348-M', 'Finn-joist_306x2208-M', 'Finn-joist_306x1480-M'] },
        { key: 'ceil-m-window', label: 'Window Frame',          collections: ['Dakspant-M'] },
        { key: 'ceil-m-spacer', label: 'Spacers',               collections: ['Finn-joist_740x306-M'] },
      ],
      E: [
        { key: 'ceil-e-horiz',  label: 'Finn-Joist Horizontal', collections: ['Finn-joist_306x2970-E', 'Finn-joist_306x2272-E', 'Finn-joist_306x1430-E', 'Finn-joist_306x3160-E', 'Finn-joist_306x732-E'] },
        { key: 'ceil-e-window', label: 'Window Frame',          collections: ['Dakspant-E'] },
        { key: 'ceil-e-spacer', label: 'Spacers',               collections: ['Finn-joist_740x306-E'] },
      ],
    },
  },
];

// State is a flat map keyed by `${building}:${toggleKey}`. ToggleKey is the step key when
// there are no sub-steps for the current building, or the sub-step key when there are.
// All toggles start on.
const state = new Map();
function stateKey(building, toggleKey) { return `${building}:${toggleKey}`; }
function getToggle(building, toggleKey) {
  const k = stateKey(building, toggleKey);
  return state.has(k) ? state.get(k) : true;
}
function setToggle(building, toggleKey, v) {
  state.set(stateKey(building, toggleKey), v);
}

// Which "effective toggles" exist for a given building. Returns a list of
//   { step, subStep (may be null), collections, toggleKey }
export function effectiveToggles(building) {
  const list = [];
  const buildings = building === 'both' ? ['M', 'E'] : [building];
  for (const step of STEPS) {
    if (building === 'both') {
      const collections = [...step.collections.M, ...step.collections.E];
      list.push({ step, subStep: null, collections, toggleKey: step.key });
    } else {
      const b = building;
      const subs = step.subSteps[b];
      if (subs.length === 0) {
        list.push({ step, subStep: null, collections: step.collections[b].slice(), toggleKey: step.key });
      } else {
        for (const sub of subs) {
          list.push({ step, subStep: sub, collections: sub.collections.slice(), toggleKey: sub.key });
        }
      }
    }
  }
  return list;
}

// Set of Blender collection names to HIDE inside Construction-M / Construction-E for the
// current (building, construction-step state) combination.
export function hiddenConstructionCollections(building) {
  const hidden = new Set();
  for (const t of effectiveToggles(building)) {
    if (!getToggle(building, t.toggleKey)) {
      for (const c of t.collections) hidden.add(c);
    }
  }
  return hidden;
}

// Build the UI into `container` for the given building; calls `onChange` whenever the user
// flips any toggle (so main.js can refresh scene visibility).
export function buildConstructionPanel(container, building, onChange) {
  container.innerHTML = '';

  // ---- "All" master control ------------------------------------------------
  // Three buttons in a vertical stack mirroring the Mode toggle: "All on", "All off",
  // "Partial". The currently-active state is highlighted. "All on" and "All off" apply;
  // "Partial" is a read-only indicator (it only lights up when the step state is mixed).
  const allWrap = document.createElement('div');
  allWrap.className = 'ctl-all';
  const allHeadLabel = document.createElement('div');
  allHeadLabel.className = 'panel-section-head';
  allHeadLabel.textContent = 'All';
  allWrap.appendChild(allHeadLabel);
  const allStack = document.createElement('div');
  allStack.className = 'btn-stack';
  const allOnBtn    = document.createElement('button');
  const allOffBtn   = document.createElement('button');
  const partialBtn  = document.createElement('button');
  allOnBtn.className   = 'stack-btn';
  allOffBtn.className  = 'stack-btn';
  partialBtn.className = 'stack-btn stack-btn-indicator';
  allOnBtn.textContent   = 'All on';
  allOffBtn.textContent  = 'All off';
  partialBtn.textContent = 'Partial';
  allStack.appendChild(allOnBtn);
  allStack.appendChild(allOffBtn);
  allStack.appendChild(partialBtn);
  allWrap.appendChild(allStack);
  container.appendChild(allWrap);

  // ---- Step columns --------------------------------------------------------
  const refreshers = [];
  for (const step of STEPS) {
    const col = document.createElement('div');
    col.className = 'ctl-step';

    const toggles = effectiveToggles(building).filter((t) => t.step.key === step.key);

    const headerBtn = document.createElement('button');
    headerBtn.className = 'ctl-step-head';
    headerBtn.textContent = step.label;
    col.appendChild(headerBtn);

    const subChipRefs = [];
    if (toggles.length > 1 || (toggles[0] && toggles[0].subStep)) {
      const subRow = document.createElement('div');
      subRow.className = 'ctl-substeps';
      for (const t of toggles) {
        const chip = document.createElement('button');
        chip.className = 'ctl-sub-chip';
        chip.textContent = t.subStep.label;
        chip.title = t.subStep.label + ' (' + t.collections.join(', ') + ')';
        chip.addEventListener('click', () => {
          setToggle(building, t.toggleKey, !getToggle(building, t.toggleKey));
          emitChange();
        });
        subChipRefs.push({ chip, toggleKey: t.toggleKey });
        subRow.appendChild(chip);
      }
      col.appendChild(subRow);
    }

    headerBtn.addEventListener('click', () => {
      if (toggles.length === 1 && !toggles[0].subStep) {
        const t = toggles[0];
        setToggle(building, t.toggleKey, !getToggle(building, t.toggleKey));
      } else {
        // Aggregate: sync all sub-toggles to the opposite of the current aggregate
        const anyOn = toggles.some((t) => getToggle(building, t.toggleKey));
        const next = !anyOn;
        for (const t of toggles) setToggle(building, t.toggleKey, next);
      }
      emitChange();
    });

    refreshers.push(() => {
      const states = toggles.map((t) => getToggle(building, t.toggleKey));
      const allOn = states.every(Boolean);
      const allOff = states.every((s) => !s);
      headerBtn.classList.toggle('active', allOn);
      headerBtn.classList.toggle('partial', !allOn && !allOff);
      for (const { chip, toggleKey } of subChipRefs) {
        chip.classList.toggle('active', getToggle(building, toggleKey));
      }
    });

    container.appendChild(col);
  }

  function refreshAll() {
    const all = effectiveToggles(building);
    const allOn = all.every((t) => getToggle(building, t.toggleKey));
    const allOff = all.every((t) => !getToggle(building, t.toggleKey));
    allOnBtn.classList.toggle('active',   allOn);
    allOffBtn.classList.toggle('active',  allOff);
    partialBtn.classList.toggle('active', !allOn && !allOff);
  }
  refreshers.push(refreshAll);

  allOnBtn.addEventListener('click', () => {
    const all = effectiveToggles(building);
    for (const t of all) setToggle(building, t.toggleKey, true);
    emitChange();
  });
  allOffBtn.addEventListener('click', () => {
    const all = effectiveToggles(building);
    for (const t of all) setToggle(building, t.toggleKey, false);
    emitChange();
  });
  // "Partial" is a read-only state marker — click is a no-op.

  function emitChange() {
    for (const r of refreshers) r();
    onChange();
  }

  for (const r of refreshers) r();
}
