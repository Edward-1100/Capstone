import { useState } from 'react';

function readMode(storageKey) {
  try {
    return localStorage.getItem(storageKey) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export default function ItemGrid({title, nameLabel, columns = [], storageKey, canEdit, newLabel, adding, onNew, addForm, empty, emptyText, query, onQuery, searchLabel, children}) {
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
    <>
      <div className="page-head">
        <h1 className="title">{title}</h1>

        {canEdit && !adding && <button type="button" className="primary" onClick={onNew}>{newLabel}</button>}
      </div>

      {adding && <section className="card add-card">{addForm}</section>}

      <section className="card">
        <div className="toolbar">
          {onQuery ? <input type="search" className="grid-search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(e) => onQuery(e.target.value)}/> : <span></span>}

          <div className="toggle" role="group" aria-label="View">
            <button type="button" className={mode === 'grid' ? 'on' : ''} onClick={() => choose('grid')}>Grid</button>
            <button type="button" className={mode === 'list' ? 'on' : ''} onClick={() => choose('list')}>List</button>
          </div>
        </div>

        {empty && !adding && <p className="muted">{emptyText}</p>}

        <ul className={`items ${mode}`} style={{'--cols': ['minmax(9rem, 1.2fr)'].concat(columns.map((column) => column.width), ['8.5rem']).join(' ')}}>
          {mode === 'list' && !empty && (
            <li className="list-head" aria-hidden="true">
              <span>{nameLabel}</span>
              {columns.map((column) => <span key={column.label}>{column.label}</span>)}
              <span></span>
            </li>
          )}

          {children}
        </ul>
      </section>
    </>
  );
}
