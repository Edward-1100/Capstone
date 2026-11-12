import { useState } from 'react';
import { setEntryTypeMappableRequest } from '../api/maps';
import NestingEditor from './NestingEditor';
import TypeChips from './TypeChips';
import Typeahead from './Typeahead';

const MODE_LABELS = {
  none: 'Can not be nested',
  chosen: 'Inside chosen types',
  all: 'Inside any type',
  own: 'Inside its own type only',
};

function summary(type, types) {
  if (type.nestMode === 'chosen') {
    const names = types.filter((other) => type.parentTypeIds.includes(other.id)).map((other) => other.name);

    return names.length > 0 ? `Inside ${names.join(', ')}` : 'Inside no type';
  }

  return MODE_LABELS[type.nestMode];
}

export default function MapSettings({worldId, types, onChanged, onClose}) {
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  async function setMappable(typeId, mappable) {
    setError('');

    try {
      await setEntryTypeMappableRequest(worldId, typeId, mappable);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleChanged() {
    await onChanged();
    setEditingId(null);
  }

  const editing = types.find((type) => type.id === editingId);
  const nested = types.filter((type) => type.nestMode !== 'none' && type.id !== editingId);

  return (
    <div className="drawer-body">
      <div className="line">
        <h1 className="title">Map settings</h1>

        <button type="button" onClick={onClose}>Close</button>
      </div>

      {error && <p role="alert">{error}</p>}

      <div>
        <h2>Can be placed on maps</h2>

        <TypeChips selected={types.filter((type) => type.mappable)} available={types.filter((type) => !type.mappable)} onAdd={(typeId) => setMappable(typeId, true)} onRemove={(typeId) => setMappable(typeId, false)} emptyText="No types yet" label="Add a type"/>
      </div>

      <div>
        <h2>Nesting</h2>

        <div className="tagbox">
          <Typeahead options={types.map((type) => ({id: type.id, label: type.name}))} onPick={setEditingId} showCount={false} placeholder="Find a type" label="Find a type to set its nesting"/>
        </div>

        {editing && <NestingEditor key={editing.id} worldId={worldId} type={editing} types={types} onChanged={handleChanged} onCancel={() => setEditingId(null)}/>}

        {nested.length > 0 && (
          <ul className="plain">
            {nested.map((type) => (
              <li key={type.id} className="line">
                <span>{type.name}</span>
                <span className="muted">{summary(type, types)}</span>
                <button type="button" onClick={() => setEditingId(type.id)}>Edit</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
