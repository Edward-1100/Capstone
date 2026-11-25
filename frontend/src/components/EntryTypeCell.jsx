import { useState } from 'react';
import { deleteEntryTypeRequest, updateEntryTypeRequest } from '../api/entryTypes';
import { setEntryTypeMappableRequest } from '../api/maps';
import { setEntryTypeTimelineableRequest } from '../api/timeline';
import { countLabel } from '../utils/text';
import NestingEditor from './NestingEditor';
import TypeFields from './TypeFields';

export default function EntryTypeCell({worldId, type, types, canEdit, onChanged}) {
  const [mode, setMode] = useState('view');
  const [tab, setTab] = useState('details');
  const [name, setName] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [moveToTypeId, setMoveToTypeId] = useState('');
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  function open(next) {
    setTab(next);
    setError('');
    setPending(null);
    setName(type.name);
    setConfirmName('');
    setMoveToTypeId('');
    setMode('open');
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

  async function setFlag(request, value) {
    setError('');

    try {
      await request(worldId, type.id, value);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDelete(event) {
    event.preventDefault();
    setPending(null);
    runDelete(false);
  }

  if (mode === 'open') {
    return (
      <li className="cell open">
        <div className="card-head">
          <h2>{type.name}</h2>

          <div className="head-actions"><button type="button" onClick={close}>Close</button></div>
        </div>

        <div className="panel-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>Details</button>
          <button type="button" role="tab" aria-selected={tab === 'fields'} className={tab === 'fields' ? 'on' : ''} onClick={() => setTab('fields')}>Fields</button>
          {canEdit && <button type="button" role="tab" aria-selected={tab === 'delete'} className={tab === 'delete' ? 'on danger' : 'danger'} onClick={() => setTab('delete')}>Delete</button>}
        </div>

        {error && <p role="alert">{error}</p>}

        {tab === 'details' && (
          <div className="stack">
            {canEdit && (
              <form className="inline-form" onSubmit={handleRename}>
                <input type="text" aria-label="Type name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required/>

                <button type="submit">Rename</button>
              </form>
            )}

            {canEdit && (
              <div className="check-row">
                <label className="check"><input type="checkbox" checked={type.mappable} onChange={(e) => setFlag(setEntryTypeMappableRequest, e.target.checked)}/> Can be placed on maps</label>
                <label className="check"><input type="checkbox" checked={type.timelineable} onChange={(e) => setFlag(setEntryTypeTimelineableRequest, e.target.checked)}/> Can be placed on timeline</label>
              </div>
            )}

            {canEdit && <NestingEditor key={`${type.id}-${type.nestMode}`} worldId={worldId} type={type} types={types} onChanged={onChanged}/>}
          </div>
        )}

        {tab === 'fields' && <TypeFields worldId={worldId} type={type} canEdit={canEdit} onChanged={onChanged}/>}

        {tab === 'delete' && canEdit && (
          <div>
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
              </div>
            </form>

            {pending && (
              <div>
                <p role="alert">{pending.message}:</p>

                <ul className="plain">
                  {pending.links.map((link) => <li key={link.entryId}>{link.name} inside {link.parentName}</li>)}
                </ul>

                <button type="button" className="danger" onClick={() => runDelete(true)}>Remove them and delete the type</button>
              </div>
            )}
          </div>
        )}
      </li>
    );
  }

  const fieldNames = type.fields.map((field) => field.name);

  return (
    <li className="cell">
      <div className="cell-name">{type.name}</div>

      <div className="cell-col" data-label="Entries">{type.entryCount}</div>

      <div className="cell-col badge-row" data-label="Fields">
        {fieldNames.length === 0 && <span className="muted">None</span>}
        {fieldNames.length > 0 && <span className="badge-scroll">{fieldNames.map((name) => <span key={name} className="mini">{name}</span>)}</span>}
      </div>

      <div className="cell-col" data-label="Placed on">
        {!type.mappable && !type.timelineable && <span className="muted">Nothing</span>}
        {type.mappable && <span className="mini on">Map</span>}
        {type.timelineable && <span className="mini on">Timeline</span>}
      </div>

      <div className="cell-actions">
        <button type="button" onClick={() => open('details')}>{canEdit ? 'Edit' : 'View'}</button>
      </div>
    </li>
  );
}
