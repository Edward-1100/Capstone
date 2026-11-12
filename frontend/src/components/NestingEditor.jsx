import { useState } from 'react';
import { setEntryTypeNestingRequest } from '../api/nesting';
import TypeChips from './TypeChips';

const MODES = [
  {value: 'none', label: 'Can not be nested'},
  {value: 'chosen', label: 'Inside chosen types'},
  {value: 'all', label: 'Inside any type'},
  {value: 'own', label: 'Inside its own type only'},
];

export default function NestingEditor({worldId, type, types, onChanged, onCancel}) {
  const [mode, setMode] = useState(type.nestMode);
  const [parentTypeIds, setParentTypeIds] = useState(type.parentTypeIds);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  function handleAddParent(typeId) {
    setParentTypeIds(parentTypeIds.concat(typeId));
  }

  function handleRemoveParent(typeId) {
    setParentTypeIds(parentTypeIds.filter((item) => item !== typeId));
  }

  async function run(confirmUnlink) {
    setError('');

    if (mode === 'chosen' && parentTypeIds.length === 0) {
      setError('Choose at least one type');

      return;
    }

    const data = {mode, confirmUnlink: confirmUnlink || undefined};

    if (mode === 'chosen') {
      data.parentTypeIds = parentTypeIds;
    }

    try {
      await setEntryTypeNestingRequest(worldId, type.id, data);
      await onChanged();
      setPending(null);
    } catch (err) {
      if (err.status === 409 && err.data && err.data.links) {
        setPending(err.data);
      } else {
        setError(err.message);
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setPending(null);
    run(false);
  }

  return (
    <section className="nest-editor">
      <h3>{type.name}</h3>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Where it can go</legend>

          {MODES.map((item) => (
            <label key={item.value}>
              <input type="radio" name={`nest-mode-${type.id}`} checked={mode === item.value} onChange={() => setMode(item.value)}/> {item.label}
            </label>
          ))}
        </fieldset>

        {mode === 'chosen' && (
          <fieldset>
            <legend>Types it can go inside</legend>

            <TypeChips selected={types.filter((other) => parentTypeIds.includes(other.id))} available={types.filter((other) => !parentTypeIds.includes(other.id))} onAdd={handleAddParent} onRemove={handleRemoveParent} emptyText="No types chosen" label="Add a type"/>
          </fieldset>
        )}

        <div className="actions">
          <button type="submit">Save</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>

      {error && <p role="alert">{error}</p>}

      {pending && (
        <fieldset>
          <legend>Links to remove</legend>

          <p role="alert">{pending.message}:</p>

          <ul className="plain">
            {pending.links.map((link) => <li key={link.entryId}>{link.name} inside {link.parentName}</li>)}
          </ul>

          <button type="button" className="danger" onClick={() => run(true)}>Remove them and save</button>
        </fieldset>
      )}
    </section>
  );
}
