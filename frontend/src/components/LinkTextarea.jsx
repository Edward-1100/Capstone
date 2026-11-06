import { useEffect, useRef, useState } from 'react';

const MAX_SHOWN = 8;

function findOpenLink(value, caret) {
  if (caret < 2) {
    return null;
  }

  const start = value.lastIndexOf('[[', caret - 2);

  if (start === -1 || /[[\]\n]/.test(value.slice(start + 2, caret))) {
    return null;
  }

  const closing = /^[^[\]\n]*\]\]/.exec(value.slice(caret));
  const end = closing ? caret + closing[0].length : caret;

  return {start, end, query: value.slice(start + 2, closing ? end - 2 : caret)};
}

function rankSuggestions(entries, wanted) {
  return entries
    .filter((entry) => entry.name.toLowerCase().includes(wanted))
    .sort((first, second) => (second.count - first.count) || first.name.localeCompare(second.name))
    .slice(0, MAX_SHOWN);
}

export default function LinkTextarea({value, onChange, entries, maxLength}) {
  const boxRef = useRef(null);
  const pendingCaret = useRef(null);
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(-1);
  const [active, setActive] = useState(0);

  const link = findOpenLink(value, caret);
  const wanted = link ? link.query.trim().toLowerCase() : '';
  const suggestions = link ? rankSuggestions(entries, wanted) : [];
  const open = focused && link !== null && link.start !== dismissed && suggestions.length > 0;

  useEffect(() => {
    if (pendingCaret.current !== null && boxRef.current) {
      boxRef.current.focus();
      boxRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      setCaret(pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);

  function pick(entry) {
    pendingCaret.current = link.start + entry.name.length + 4;
    onChange(`${value.slice(0, link.start)}[[${entry.name}]]${value.slice(link.end)}`);
    setActive(0);
  }

  function handleChange(event) {
    onChange(event.target.value);
    setCaret(event.target.selectionStart);
    setActive(0);
    setDismissed(-1);
  }

  function handleOptionDown(event, entry) {
    event.preventDefault();
    pick(entry);
  }

  function handleKeyDown(event) {
    if (!open) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(Math.min(active + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      pick(suggestions[Math.min(active, suggestions.length - 1)]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDismissed(link.start);
    }
  }

  return (
    <div className="link-textarea">
      <textarea
        ref={boxRef}
        className="description-input"
        aria-label="Description"
        aria-autocomplete="list"
        aria-expanded={open}
        value={value}
        maxLength={maxLength}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => setCaret(e.target.selectionStart)}
        onClick={(e) => setCaret(e.target.selectionStart)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />

      {open && (
        <ul className="typeahead-list" role="listbox">
          {suggestions.map((entry, index) => (
            <li key={entry.id} role="option" aria-selected={index === active} className={index === active ? 'active' : ''} onMouseDown={(event) => handleOptionDown(event, entry)} onMouseEnter={() => setActive(index)}>
              <span>{entry.name}</span>

              <span className="muted">{entry.typeName || 'no type'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
