import { useState } from 'react';

const MAX_SHOWN = 30;

export default function Typeahead({options, onPick, placeholder, label}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const wanted = text.trim().toLowerCase();
  const matches = options
    .filter((option) => option.label.toLowerCase().includes(wanted))
    .sort((first, second) => (second.count - first.count) || first.label.localeCompare(second.label))
    .slice(0, MAX_SHOWN);

  function pick(option) {
    onPick(option.id);
    setText('');
    setActive(0);
  }

  function handleChange(event) {
    setText(event.target.value);
    setActive(0);
    setOpen(true);
  }

  function handleOptionDown(event, option) {
    event.preventDefault();
    pick(option);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive(Math.min(active + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();

      if (matches[active]) {
        pick(matches[active]);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <span className="typeahead">
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        placeholder={placeholder}
        value={text}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <ul className="typeahead-list" role="listbox">
          {matches.length === 0 && <li className="muted">No matches</li>}

          {matches.map((option, index) => (
            <li key={option.id} role="option" aria-selected={index === active} className={index === active ? 'active' : ''} onMouseDown={(event) => handleOptionDown(event, option)} onMouseEnter={() => setActive(index)}>
              <span>{option.label}</span>

              <span className="muted">{option.count}</span>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
