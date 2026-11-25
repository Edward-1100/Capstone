import { useState } from 'react';
import { applyTheme, getTheme, saveTheme, THEMES } from '../utils/theme';

export default function ThemePicker() {
  const [theme, setTheme] = useState(getTheme());

  function handleChange(e) {
    const id = e.target.value;

    setTheme(id);
    applyTheme(id);
    saveTheme(id);
  }

  return (
    <label className="theme-picker">
      <span>Theme</span>

      <select value={theme} onChange={handleChange}>
        {THEMES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
  );
}
