// Central scene-visibility composer. Takes the current (mode, building, constructionStepState)
// and applies it to the scene by flipping `.visible` on collection subtrees.
//
// Order of filtering (each one narrows what's visible):
//   1. Building selector hides the entire other-building top-level collection.
//   2. Mode (Rendered / Construction) hides specific sibling collections inside each
//      visible building:
//        - rendered:    hide Construction-<B>; keep everything else incl. Foundation-<B>.
//        - construction: hide EVERYTHING in <B> except Construction-<B> and Foundation-<B>.
//   3. In construction mode, construction-step toggles further hide named sub-collections
//      (e.g. "Finn-joist 2758x200-M") inside Construction-<B>.

function setBranchVisible(obj, visible) {
  if (!obj) return;
  obj.traverse((o) => { o.visible = visible; });
}

function findByName(root, name) {
  let found = null;
  root.traverse((o) => { if (!found && o.name === name) found = o; });
  return found;
}

// Hide every node whose name is `<name>` OR `<name>` followed by a run of digits (glTF
// de-duplicates repeated node names by appending 0, 1, 2 …; in Blender a collection can
// hold many objects sharing one name, so after export those all land as siblings with
// numeric suffixes).
function hideByName(root, name) {
  root.traverse((o) => {
    if (!o.name || !o.name.startsWith(name)) return;
    const rest = o.name.slice(name.length);
    if (rest === '' || /^\d+$/.test(rest)) {
      o.traverse((c) => { c.visible = false; });
    }
  });
}

export function applyVisibility({ sceneRoot, mode, building, hiddenConstructionCols }) {
  if (!sceneRoot) return;

  // Reset: everything visible
  setBranchVisible(sceneRoot, true);

  // 1. Building filter
  if (building === 'M') hideByName(sceneRoot, 'E');
  else if (building === 'E') hideByName(sceneRoot, 'M');

  // 2. Mode filter — per visible building
  const activeBuildings = building === 'both' ? ['M', 'E'] : [building];
  for (const b of activeBuildings) {
    const project = findByName(sceneRoot, b);
    if (!project) continue;
    for (const child of project.children) {
      if (mode === 'rendered') {
        if (child.name === `Construction-${b}`) setBranchVisible(child, false);
      } else if (mode === 'construction') {
        const keep = (child.name === `Construction-${b}` || child.name === `Foundation-${b}`);
        setBranchVisible(child, keep);
      }
    }
  }

  // 3. Construction-step filter (only in construction mode)
  if (mode === 'construction' && hiddenConstructionCols && hiddenConstructionCols.size > 0) {
    for (const name of hiddenConstructionCols) hideByName(sceneRoot, name);
  }
}
