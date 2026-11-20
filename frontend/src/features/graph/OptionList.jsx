import { useId, useState } from 'react';

export default function OptionList({label, options, isChecked, onChange, single}) {
  const [term, setTerm] = useState('');
  const name = useId();
  const query = term.trim().toLowerCase();
  const shown = query ? options.filter((option) => option.label.toLowerCase().includes(query)) : options;
  const chosen = options.filter((option) => isChecked(option.id)).length;
  const ids = shown.map((option) => option.id);

  return (
    <details className="option-list">
      <summary>
        {label}
        {!single && <span className="option-summary">{chosen} of {options.length}</span>}
      </summary>

      <input type="search" aria-label={`Search ${label}`} placeholder="Search" value={term} onChange={(e) => setTerm(e.target.value)}/>

      {!single && (
        <div className="option-actions">
          <button type="button" className="small" disabled={shown.length === 0} onClick={() => onChange(ids, true)}>{query ? 'Select matches' : 'Select all'}</button>
          <button type="button" className="small" disabled={shown.length === 0} onClick={() => onChange(ids, false)}>{query ? 'Clear matches' : 'Clear all'}</button>
        </div>
      )}

      <div className="option-scroll">
        {shown.map((option) => (
          <label className="check" key={option.id}>
            <input type={single ? 'radio' : 'checkbox'} name={single ? name : undefined} checked={isChecked(option.id)} onChange={(e) => onChange([option.id], e.target.checked)}/>
            {option.label}
          </label>
        ))}

        {shown.length === 0 && <p className="muted">Nothing found</p>}
      </div>
    </details>
  );
}
