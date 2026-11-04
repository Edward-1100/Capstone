import { useState } from 'react';

function readMode(storageKey) {
  try {
    return localStorage.getItem(storageKey) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export default function ItemGrid({storageKey, canEdit, newLabel, adding, onNew, addForm, empty, emptyText, children}) {
  const [mode, setMode] = useState(() => readMode(storageKey));

  function choose(next) {
    setMode(next);

    try {
      localStorage.setItem(storageKey, next);
    } catch {
      return;
    }
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <div className="toggle" role="group" aria-label="View">
          <button type="button" className={mode === 'grid' ? 'on' : ''} onClick={() => choose('grid')}>Grid</button>
          <button type="button" className={mode === 'list' ? 'on' : ''} onClick={() => choose('list')}>List</button>
        </div>

        {canEdit && !adding && <button type="button" onClick={onNew}>{newLabel}</button>}
      </div>

      {adding && <div className="add-panel">{addForm}</div>}

      {empty && !adding && <p className="muted">{emptyText}</p>}

      <ul className={`items ${mode}`}>
        {children}
      </ul>
    </div>
  );
}
