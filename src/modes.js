// Mode toggle UI (Rendered / Construction). Visibility application lives in visibility.js.

export function buildModeToggle(container, initialMode, onChange) {
  container.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'btn-stack';
  container.appendChild(row);

  const modes = [
    { key: 'rendered', label: 'Rendered' },
    { key: 'construction', label: 'Construction' },
  ];
  let active = initialMode;
  const buttons = {};
  for (const m of modes) {
    const b = document.createElement('button');
    b.className = 'stack-btn';
    b.textContent = m.label;
    if (m.key === active) b.classList.add('active');
    b.addEventListener('click', () => {
      if (active === m.key) return;
      active = m.key;
      for (const k in buttons) buttons[k].classList.toggle('active', k === m.key);
      onChange(m.key);
    });
    buttons[m.key] = b;
    row.appendChild(b);
  }
  return { setMode: (k) => { if (buttons[k]) buttons[k].click(); } };
}
