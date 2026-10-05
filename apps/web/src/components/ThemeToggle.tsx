import { useEffect, useState } from 'react';

type Mode = 'system' | 'light' | 'dark';
const OPTIONS: [Mode, string][] = [['system', 'Tự động'], ['light', 'Sáng'], ['dark', 'Tối']];

const read = (): Mode => {
  try {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

/** Tự động = theo hệ điều hành (không đặt data-theme); Sáng/Tối = ép theme và nhớ trong localStorage. */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') delete root.dataset.theme;
    else root.dataset.theme = mode;
    try {
      if (mode === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', mode);
    } catch { /* trình duyệt chặn storage: bỏ qua, không nhớ lựa chọn */ }
  }, [mode]);

  return (
    <div className="theme" role="group" aria-label="Giao diện">
      {OPTIONS.map(([id, label]) => (
        <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>
      ))}
    </div>
  );
}
