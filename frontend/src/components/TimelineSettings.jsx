import { useState } from 'react';
import { setEntryTypeTimelineableRequest } from '../api/timeline';
import TypeSelect from './TypeSelect';

export default function TimelineSettings({worldId, types, onChanged, onClose}) {
  const [error, setError] = useState('');

  async function handleChange(ids) {
    setError('');

    try {
      for (const type of types) {
        const wanted = ids.includes(type.id);

        if (wanted !== Boolean(type.timelineable)) {
          await setEntryTypeTimelineableRequest(worldId, type.id, wanted);
        }
      }
    } catch (err) {
      setError(err.message);
    }

    await onChanged();
  }

  return (
    <div className="drawer-body">
      <div className="line">
        <h1 className="title">Timeline settings</h1>

        <button type="button" onClick={onClose}>Close</button>
      </div>

      {error && <p role="alert">{error}</p>}

      <div>
        <h2>Can be placed on timeline</h2>

        <TypeSelect types={types} selectedIds={types.filter((type) => type.timelineable).map((type) => type.id)} onChange={handleChange}/>
      </div>
    </div>
  );
}
