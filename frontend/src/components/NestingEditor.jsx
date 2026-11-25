import { useState } from 'react';
import { setEntryTypeNestingRequest } from '../api/nesting';
import NestingFields from './NestingFields';

export default function NestingEditor({worldId, type, types, onChanged, onCancel}) {
  const [mode, setMode] = useState(type.nestMode);
  const [parentTypeIds, setParentTypeIds] = useState(type.parentTypeIds);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

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
      <form onSubmit={handleSubmit}>
        <NestingFields name={`nest-mode-${type.id}`} types={types} mode={mode} parentTypeIds={parentTypeIds} onMode={setMode} onParentTypeIds={setParentTypeIds}/>

        <div className="actions">
          <button type="submit">Save nesting</button>
          {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
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
