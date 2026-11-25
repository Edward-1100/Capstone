import { useState } from 'react';
import { createTimelineEntryRequest } from '../api/timeline';
import { emptyDateValues } from '../utils/timeline';
import TimelineDateForm from './TimelineDateForm';

const SHOWN = 60;

export default function TimelineAddPanel({worldId, entries, types, items, onAdded, onOpenSettings, onClose}) {
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState('');
  const [picked, setPicked] = useState(null);

  const allowed = types.filter((type) => type.timelineable);
  const placedIds = items.map((item) => item.entryId);
  const term = search.trim().toLowerCase();
  const eligible = entries.filter((entry) => entry.typeId && allowed.some((type) => type.id === entry.typeId) && !placedIds.includes(entry.id));
  const matching = eligible.filter((entry) => (typeId === '' || entry.typeId === typeId) && entry.name.toLowerCase().includes(term));

  async function handleSubmit(payload) {
    const created = await createTimelineEntryRequest(worldId, Object.assign({entryId: picked.id}, payload));

    await onAdded(created);
  }

  function typeName(id) {
    const type = types.find((item) => item.id === id);

    return type ? type.name : '';
  }

  if (picked) {
    return (
      <div className="drawer-body">
        <div className="line">
          <h1 className="title">Add to timeline</h1>

          <button type="button" onClick={onClose}>Close</button>
        </div>

        <p><strong>{picked.name}</strong> <span className="muted">{typeName(picked.typeId)}</span></p>

        <TimelineDateForm key={picked.id} initialValues={emptyDateValues()} submitLabel="Add to timeline" onSubmit={handleSubmit} onCancel={() => setPicked(null)}/>
      </div>
    );
  }

  return (
    <div className="drawer-body">
      <div className="line">
        <h1 className="title">Add to timeline</h1>

        <button type="button" onClick={onClose}>Close</button>
      </div>

      {allowed.length === 0 && (
        <div>
          <p>No entry types are allowed on the timeline yet.</p>

          <button type="button" onClick={onOpenSettings}>Choose entry types</button>
        </div>
      )}

      {allowed.length > 0 && (
        <>
          <input type="search" aria-label="Search entries" placeholder="Search entries" value={search} onChange={(e) => setSearch(e.target.value)}/>

          {allowed.length > 1 && (
            <select aria-label="Entry type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">All allowed types</option>
              {allowed.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          )}

          {eligible.length === 0 && <p className="muted">Every entry of the allowed types is already on the timeline</p>}

          {eligible.length > 0 && matching.length === 0 && <p className="muted">Nothing matches</p>}

          <ul className="pick-list">
            {matching.slice(0, SHOWN).map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => setPicked(entry)}>
                  <span>{entry.name}</span>
                  <span className="muted">{typeName(entry.typeId)}</span>
                </button>
              </li>
            ))}
          </ul>

          {matching.length > SHOWN && <p className="muted">Showing {SHOWN} of {matching.length}, search to narrow it down</p>}

          <p className="muted"><button type="button" className="link" onClick={onOpenSettings}>Change allowed entry types</button></p>
        </>
      )}
    </div>
  );
}
