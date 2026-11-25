import { useState } from 'react';
import { setEntryTypeMappableRequest } from '../api/maps';
import NestingEditor from './NestingEditor';
import Typeahead from './Typeahead';
import TypeSelect from './TypeSelect';
import { nestSummary } from '../utils/nesting';

export default function MapSettings({worldId, types, onChanged, onClose}) {
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  async function handleChange(ids) {
    setError('');

    try {
      for (const type of types) {
        const wanted = ids.includes(type.id);

        if (wanted !== Boolean(type.mappable)) {
          await setEntryTypeMappableRequest(worldId, type.id, wanted);
        }
      }
    } catch (err) {
      setError(err.message);
    }

    await onChanged();
  }

  const rows = types.filter((type) => type.nestMode !== 'none' || type.id === editingId);
  const others = types.filter((type) => !rows.includes(type));

  async function handleChanged() {
    await onChanged();
    setEditingId(null);
  }

  return (
    <div className="drawer-body settings-body">
      <div className="line">
        <h1 className="title">Map settings</h1>

        <button type="button" onClick={onClose}>Close</button>
      </div>

      {error && <p role="alert">{error}</p>}

      <div>
        <h2>Can be placed on maps</h2>

        <TypeSelect types={types} selectedIds={types.filter((type) => type.mappable).map((type) => type.id)} onChange={handleChange}/>
      </div>

      <div className="nest-section">
        <h2>Nesting</h2>

        {others.length > 0 && (
          <div className="nest-find">
            <Typeahead options={others.map((type) => ({id: type.id, label: type.name}))} onPick={setEditingId} placeholder="Search for a type to set its nesting" label="Set nesting for a type" showCount={false}/>
          </div>
        )}

        <ul className="nest-rows">
          {rows.map((type) => (
            <li key={type.id}>
              <div className="nest-row">
                <b>{type.name}</b>
                <span className="muted nest-sum">{nestSummary(type, types)}</span>

                {editingId !== type.id && <button type="button" onClick={() => setEditingId(type.id)}>Edit</button>}
              </div>

              {editingId === type.id && <NestingEditor key={type.id} worldId={worldId} type={type} types={types} onChanged={handleChanged} onCancel={() => setEditingId(null)}/>}
            </li>
          ))}

          {rows.length === 0 && <li className="muted">No type can be nested yet</li>}
        </ul>
      </div>
    </div>
  );
}
