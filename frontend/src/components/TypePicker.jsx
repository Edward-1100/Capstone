import { useState } from 'react';

const FILTERS = [
  {value: 'all', label: 'All'},
  {value: 'on', label: 'Selected'},
  {value: 'off', label: 'Not selected'},
];

export default function TypePicker({types, selectedIds, onChange, renderExtra, renderBelow, searchLabel = 'Search types', emptyText = 'No entry types yet', compact = false}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const term = query.trim().toLowerCase();
  const shown = types.filter((type) => {
    const on = selectedIds.includes(type.id);

    return type.name.toLowerCase().includes(term) && (filter === 'all' || (filter === 'on' ? on : !on));
  });
  const shownIds = shown.map((type) => type.id);
  const tools = types.length > 6;

  function toggle(typeId, checked) {
    onChange(checked ? selectedIds.concat([typeId]) : selectedIds.filter((id) => id !== typeId));
  }

  function selectShown() {
    onChange(selectedIds.concat(shownIds.filter((id) => !selectedIds.includes(id))));
  }

  function clearShown() {
    onChange(selectedIds.filter((id) => !shownIds.includes(id)));
  }

  if (types.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="type-picker">
      {tools && (
        <div className="picker-tools">
          <input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(e) => setQuery(e.target.value)}/>

          <div className="toggle" role="group" aria-label="Show">
            {FILTERS.map((item) => <button key={item.value} type="button" className={filter === item.value ? 'on' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}
          </div>
        </div>
      )}

      <div className="picker-count">
        <span className="muted">{selectedIds.length} of {types.length} selected</span>

        {types.length > 1 && (
          <span className="picker-bulk">
            <button type="button" className="link" onClick={selectShown} disabled={shown.length === 0}>Select {tools && (term !== '' || filter !== 'all') ? 'shown' : 'all'}</button>
            <button type="button" className="link" onClick={clearShown} disabled={shown.length === 0}>Clear {tools && (term !== '' || filter !== 'all') ? 'shown' : 'all'}</button>
          </span>
        )}
      </div>

      <ul className={compact ? 'picker-list compact' : 'picker-list'}>
        {shown.map((type) => (
          <li key={type.id}>
            <div className="picker-row">
              <label className="check">
                <input type="checkbox" checked={selectedIds.includes(type.id)} onChange={(e) => toggle(type.id, e.target.checked)}/>
                <span>{type.name}</span>
              </label>

              {renderExtra && renderExtra(type)}
            </div>

            {renderBelow && renderBelow(type)}
          </li>
        ))}

        {shown.length === 0 && <li className="muted picker-none">Nothing matches</li>}
      </ul>
    </div>
  );
}
