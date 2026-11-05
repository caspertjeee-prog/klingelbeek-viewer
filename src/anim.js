// Tiny tween helper, no gsap dependency.
export function gsapTween() {}

export function tween({ from, to, duration = 900, ease = easeInOutCubic, onUpdate, onDone }) {
  const start = performance.now();
  const keys = Object.keys(from);
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const e = ease(t);
    const v = {};
    for (const k of keys) v[k] = from[k] + (to[k] - from[k]) * e;
    onUpdate(v);
    if (t < 1) requestAnimationFrame(frame);
    else if (onDone) onDone();
  }
  requestAnimationFrame(frame);
}

export function tweenVec3({ obj, to, duration = 900, onUpdate, onDone }) {
  const from = { x: obj.x, y: obj.y, z: obj.z };
  const target = { x: to.x, y: to.y, z: to.z };
  tween({
    from, to: target, duration,
    onUpdate: (v) => { obj.set(v.x, v.y, v.z); if (onUpdate) onUpdate(); },
    onDone,
  });
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
