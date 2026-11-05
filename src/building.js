// Building selector: which of the two buildings (M, E, or both) is shown.
// Hides the other building's top-level collection in the scene and filters the
// camera chip list.

export const BUILDING_OPTIONS = [
  { key: 'M',    label: 'M' },
  { key: 'E',    label: 'E' },
  { key: 'both', label: 'Both' },
];

// Which top-level scene nodes get hidden for each building selection.
// (The Blender scene has top-level 'M' and 'E' collections holding everything of each.)
export function hiddenTopLevelForBuilding(building) {
  if (building === 'M') return ['E'];
  if (building === 'E') return ['M'];
  return [];
}

// Does a camera name belong to the currently selected building(s)?
// - 'M'   → M-Exterior-*, M-Interior-*, M-Plan
// - 'E'   → E-Exterior-*, E-Interior-*, E-Plan
// - 'both' → everything (M-*, E-*, Both-*, Both-Plan)
export function cameraMatchesBuilding(cameraName, building) {
  if (building === 'both') return true;
  if (building === 'M') return cameraName.startsWith('M-');
  if (building === 'E') return cameraName.startsWith('E-');
  return true;
}

export function buildBuildingToggle(container, initial, onChange) {
  container.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'btn-stack';
  container.appendChild(row);

  let active = initial;
  const buttons = {};
  for (const opt of BUILDING_OPTIONS) {
    const b = document.createElement('button');
    b.className = 'stack-btn';
    b.textContent = opt.label;
    if (opt.key === active) b.classList.add('active');
    b.addEventListener('click', () => {
      if (active === opt.key) return;
      active = opt.key;
      for (const k in buttons) buttons[k].classList.toggle('active', k === opt.key);
      onChange(opt.key);
    });
    buttons[opt.key] = b;
    row.appendChild(b);
  }
  return { setBuilding: (k) => { if (buttons[k]) buttons[k].click(); } };
}
