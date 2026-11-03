import { useState } from 'react';
import { deleteEntryTypeRequest, updateEntryTypeRequest } from '../api/entryTypes';
import { countLabel } from '../utils/text';
import TypeFields from './TypeFields';

export default function EntryTypeCell({worldId, type, types, canEdit, onChanged}) {
  const [mode, setMode] = useState('view');
  const [name, setName] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [moveToTypeId, setMoveToTypeId] = useState('');
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  function open(next) {
    setError('');
    setPending(null);
    setName(type.name);
    setConfirmName('');
    setMoveToTypeId('');
    setMode(next);
  }

  function close() {
    setMode('view');
    setError('');
    setPending(null);
  }

  async function handleRename(event) {
    event.preventDefault();
    setError('');

    try {
      await updateEntryTypeRequest(worldId, type.id, name);
      close();
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function runDelete(confirmUnlink) {
    setError('');

    try {
      await deleteEntryTypeRequest(worldId, type.id, confirmName, moveToTypeId || undefined, confirmUnlink || undefined);
      await onChanged();
    } catch (err) {
      if (err.status === 409 && err.data && err.data.links) {
        setPending(err.data);
      } else {
        setError(err.message);
      }
    }
  }

  function handleDelete(event) {
    event.preventDefault();
    setPending(null);
    runDelete(false);
  }

  if (mode === 'edit') {
    return (
      <li className="cell open">
        <form className="inline-form" onSubmit={handleRename}>
          <input type="text" aria-label="Type name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required/>

          <button type="submit">Save</button>
          <button type="button" onClick={close}>Cancel</button>

          {error && <p role="alert">{error}</p>}
        </form>
      </li>
    );
  }

  if (mode === 'fields') {
    return (
      <li className="cell open">
        <div className="line">
          <span className="cell-name">Fields for {type.name}</span>
          <button type="button" onClick={close}>Close</button>
        </div>

        <TypeFields worldId={worldId} type={type} canEdit={canEdit} onChanged={onChanged}/>
      </li>
    );
  }

  if (mode === 'delete') {
    return (
      <li className="cell open">
        <p>{countLabel(type.entryCount, 'entry uses', 'entries use')} the type {type.name}.</p>

        <form onSubmit={handleDelete}>
          {type.entryCount > 0 && (
            <div>
              <label htmlFor={`move-${type.id}`}>What should happen to those entries?</label>

              <select id={`move-${type.id}`} value={moveToTypeId} onChange={(e) => setMoveToTypeId(e.target.value)}>
                <option value="">Leave them without a type</option>
                {types.filter((other) => other.id !== type.id).map((other) => <option key={other.id} value={other.id}>Move to {other.name}</option>)}
              </select>
            </div>
          )}

          <div className="inline-form">
            <input type="text" aria-label="Type the type name to confirm" placeholder={`Type ${type.name} to confirm`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

            <button type="submit" className="danger" disabled={confirmName !== type.name}>Delete type</button>
            <button type="button" onClick={close}>Cancel</button>
          </div>
        </form>

        {error && <p role="alert">{error}</p>}

        {pending && (
          <div>
            <p role="alert">{pending.message}:</p>

            <ul className="plain">
              {pending.links.map((link) => <li key={link.entryId}>{link.name} inside {link.parentName}</li>)}
            </ul>

            <button type="button" className="danger" onClick={() => runDelete(true)}>Remove them and delete the type</button>
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="cell">
      <div className="cell-name">{type.name}</div>

      <div className="cell-info">{countLabel(type.entryCount, 'entry', 'entries')}, {countLabel(type.fields.length, 'field', 'fields')}</div>

      {canEdit && (
        <div className="cell-actions">
          <button type="button" onClick={() => open('edit')}>Rename</button>
          <button type="button" onClick={() => open('fields')}>Fields</button>
          <button type="button" className="danger" onClick={() => open('delete')}>Delete</button>
        </div>
      )}

      {!canEdit && type.fields.length > 0 && (
        <div className="cell-actions">
          <button type="button" onClick={() => open('fields')}>Fields</button>
        </div>
      )}
    </li>
  );
}
