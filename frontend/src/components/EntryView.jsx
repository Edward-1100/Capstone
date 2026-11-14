import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteEntryRequest, getEntryEditorsRequest, getEntryRequest, listEntriesRequest, startEntryEditingRequest, stopEntryEditingRequest, updateEntryRequest } from '../api/entries';
import { listEntryTypesRequest } from '../api/entryTypes';
import { useAuth } from '../context/AuthContext';
import { applyChoices, findConflicts, hasChanges } from '../utils/conflicts';
import { formatValue } from '../utils/fields';
import { editorsLabel } from '../utils/text';
import EntryConflict from './EntryConflict';
import EntryComments from './EntryComments';
import EntryGallery from './EntryGallery';
import EntryNotes from './EntryNotes';
import EntryPlace from './EntryPlace';
import EntryRelationships from './EntryRelationships';
import EntryTags from './EntryTags';
import FieldInput from './FieldInput';
import LinkedText from './LinkedText';
import LinkTextarea from './LinkTextarea';

const EDITING_PING_MS = 10000;
const MAX_RETRIES = 3;

export default function EntryView({worldId, entryId, role, pageLink, sideNotes, onDeleted, onChanged}) {
  const {user} = useAuth();

  const canEdit = role === 'owner' || role === 'editor';

  const [entry, setEntry] = useState(null);
  const [types, setTypes] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [typeDraft, setTypeDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [valuesDraft, setValuesDraft] = useState({});
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null);
  const [editors, setEditors] = useState([]);
  const [unlink, setUnlink] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const requests = [getEntryRequest(worldId, entryId), listEntriesRequest(worldId)];

    if (canEdit) {
      requests.push(listEntryTypesRequest(worldId));
    }

    Promise.all(requests)
      .then(([entryData, entryList, typeData]) => {
        setEntry(entryData);
        setAllEntries(entryList);
        setTypes(typeData || []);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err));
  }, [worldId, entryId, canEdit]);

  const active = editing !== '';

  useEffect(() => {
    if (!canEdit) {
      return undefined;
    }

    let stopped = false;

    function ping() {
      const request = active ? startEntryEditingRequest(worldId, entryId) : getEntryEditorsRequest(worldId, entryId);

      request.then((data) => {
        if (!stopped) {
          setEditors(data.editors);
        }
      }).catch(() => undefined);
    }

    ping();

    const timer = setInterval(ping, EDITING_PING_MS);

    return () => {
      stopped = true;
      clearInterval(timer);

      if (active) {
        stopEntryEditingRequest(worldId, entryId).catch(() => undefined);
      }
    };
  }, [canEdit, active, worldId, entryId]);

  function startEdit(section) {
    setError('');
    setConflict(null);
    setUnlink(null);
    setEditing(section);
    setNameDraft(entry.name);
    setTypeDraft(entry.typeId || '');
    setDescriptionDraft(entry.description);
    setValuesDraft(Object.assign({}, entry.fields));
  }

  function cancelEdit() {
    setEditing('');
    setError('');
    setConflict(null);
    setUnlink(null);
  }

  function notifyChanged() {
    if (onChanged) {
      onChanged();
    }
  }

  function handleGalleryChange(data) {
    setEntry(data);
    notifyChanged();
  }

  function finishWith(data) {
    setEntry(data);
    setConflict(null);
    setUnlink(null);
    setEditing('');
    notifyChanged();
  }

  function handleConflict(current, changes, attempt) {
    const result = findConflicts(entry, current, changes);

    if (result.conflicts.length > 0) {
      setConflict({current, merged: result.merged, items: result.conflicts, choices: {}});
    } else if (!hasChanges(result.merged)) {
      finishWith(current);
    } else if (attempt >= MAX_RETRIES) {
      setError('This entry keeps changing. Try again in a moment');
    } else {
      save(result.merged, current.version, attempt + 1);
    }
  }

  async function save(changes, version, attempt) {
    setError('');
    setConflict(null);

    try {
      const updated = await updateEntryRequest(worldId, entryId, Object.assign({version: version || entry.version}, changes));

      finishWith(updated);
    } catch (err) {
      if (err.status === 409 && err.data && err.data.links) {
        setUnlink(err.data);
      } else if (err.status === 409 && err.data && err.data.current) {
        handleConflict(err.data.current, changes, attempt || 1);
      } else {
        setError(err.message);
      }
    }
  }

  function handleChoose(id, side) {
    setConflict(Object.assign({}, conflict, {choices: Object.assign({}, conflict.choices, {[id]: side})}));
  }

  function handleResolve() {
    const changes = applyChoices(conflict.current, conflict.merged, conflict.items, conflict.choices);

    if (hasChanges(changes)) {
      save(changes, conflict.current.version, 1);
    } else {
      finishWith(conflict.current);
    }
  }

  function handleDiscard() {
    finishWith(conflict.current);
  }

  function buildFields() {
    const fields = {};

    for (const definition of entry.typeFields) {
      const value = valuesDraft[definition.id];
      const blank = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

      fields[definition.id] = blank ? null : value;
    }

    return fields;
  }

  function setValue(fieldId, value) {
    setValuesDraft(Object.assign({}, valuesDraft, {[fieldId]: value}));
  }

  function handleSaveName(event) {
    event.preventDefault();
    save({name: nameDraft});
  }

  function handleSaveType(event) {
    event.preventDefault();
    save({typeId: typeDraft || null});
  }

  function handleConfirmUnlink() {
    save({typeId: typeDraft || null, confirmUnlink: true});
  }

  function handleSaveDescription(event) {
    event.preventDefault();
    save({description: descriptionDraft});
  }

  function handleSaveFields(event) {
    event.preventDefault();
    save({fields: buildFields()});
  }

  async function handleDelete() {
    setError('');

    try {
      await deleteEntryRequest(worldId, entryId);
      onDeleted();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loadError) {
    return (
      <div className="panel">
        <p role="alert">{loadError.message}</p>

        {loadError.status === 401 && <p><Link to="/login">Log in</Link></p>}
      </div>
    );
  }

  if (!entry) {
    return <div className="panel"><p>Loading</p></div>;
  }

  const shownFields = entry.typeFields.filter((definition) => definition.required || formatValue(definition, entry.fields[definition.id]) !== '');

  const notes = canEdit ? <div className="section notes"><EntryNotes worldId={worldId} entryId={entryId} role={role}/></div> : null;

  const panel = (
    <div className="panel">
      <div className="section">
        {editing !== 'name' && (
          <div className="line">
            <h1 className="title">{entry.name}</h1>

            {canEdit && <button type="button" onClick={() => startEdit('name')}>Edit</button>}
          </div>
        )}

        {editing === 'name' && (
          <form className="inline-form" onSubmit={handleSaveName}>
            <input type="text" aria-label="Name" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={100} required/>

            <button type="submit">Save</button>
            <button type="button" onClick={cancelEdit}>Cancel</button>
          </form>
        )}

        {editing !== 'type' && (
          <div className="line">
            <span>Type: {entry.typeName || 'none'}</span>

            {canEdit && <button type="button" onClick={() => startEdit('type')}>Edit</button>}
          </div>
        )}

        {editing === 'type' && (
          <form className="inline-form" onSubmit={handleSaveType}>
            <select aria-label="Type" value={typeDraft} onChange={(e) => setTypeDraft(e.target.value)}>
              <option value="">No type</option>
              {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>

            <button type="submit">Save</button>
            <button type="button" onClick={cancelEdit}>Cancel</button>
          </form>
        )}

        {editors.length > 0 && <p className="editing-notice" role="status">{editorsLabel(editors)}</p>}

        <EntryPlace worldId={worldId} entry={entry} types={types} canEdit={canEdit} editing={editing} onEdit={() => startEdit('parent')} onCancel={cancelEdit} onSave={(parentId) => save({parentId})}/>
      </div>

      {conflict && <EntryConflict current={conflict.current} items={conflict.items} choices={conflict.choices} types={types} allEntries={allEntries} mineName={user ? user.username : 'You'} onChoose={handleChoose} onSave={handleResolve} onDiscard={handleDiscard}/>}

      {(error || unlink) && (
        <div>
          {error && <p role="alert">{error}</p>}

          {unlink && (
            <div>
              <p role="alert">{unlink.message}:</p>

              <ul className="plain">
                {unlink.links.map((link) => <li key={link.entryId}>{link.name} inside {link.parentName}</li>)}
              </ul>

              <button type="button" className="danger" onClick={handleConfirmUnlink}>Remove them and save</button>
            </div>
          )}
        </div>
      )}

      <div className="section">
        <EntryGallery worldId={worldId} entryId={entryId} entryName={entry.name} images={entry.images} canEdit={canEdit} onChange={handleGalleryChange}/>
      </div>

      <div className="section">
        {editing !== 'description' && <div className="description">{entry.description ? <LinkedText worldId={worldId} text={entry.description} entries={allEntries}/> : <span className="muted">No description yet</span>}</div>}

        {editing === 'description' && (
          <form onSubmit={handleSaveDescription}>
            <LinkTextarea value={descriptionDraft} onChange={setDescriptionDraft} maxLength={20000} entries={allEntries.filter((item) => item.id !== entryId && !/[[\]]/.test(item.name)).map((item) => ({id: item.id, name: item.name, typeName: item.typeName, count: item.relationshipCount}))}/>

            <div className="actions">
              <button type="submit">Save</button>
              <button type="button" onClick={cancelEdit}>Cancel</button>
            </div>
          </form>
        )}

        {canEdit && editing !== 'description' && <div className="actions"><button type="button" onClick={() => startEdit('description')}>Edit description</button></div>}
      </div>

      {entry.typeFields.length > 0 && (canEdit || shownFields.length > 0) && (
        <div className="section">
          <div className="line">
            <h2>Details</h2>

            {canEdit && editing !== 'fields' && <button type="button" onClick={() => startEdit('fields')}>Edit</button>}
          </div>

          {editing !== 'fields' && shownFields.length > 0 && (
            <dl className="facts">
              {shownFields.map((definition) => (
                <div className="fact" key={definition.id}>
                  <dt>{definition.name}</dt>
                  <dd className={definition.fieldType === 'long_text' ? 'long' : ''}>{formatValue(definition, entry.fields[definition.id]) || 'not set'}</dd>
                </div>
              ))}
            </dl>
          )}

          {editing === 'fields' && (
            <form onSubmit={handleSaveFields}>
              {entry.typeFields.map((definition) => (
                <div key={definition.id}>
                  <label htmlFor={`field-${definition.id}`}>{definition.name}{definition.required && ' (required)'}</label>
                  <FieldInput definition={definition} value={valuesDraft[definition.id]} onChange={(value) => setValue(definition.id, value)}/>
                </div>
              ))}

              <div className="actions">
                <button type="submit">Save</button>
                <button type="button" onClick={cancelEdit}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="section"><EntryTags worldId={worldId} entryId={entryId} canEdit={canEdit}/></div>

      <div className="section"><EntryRelationships worldId={worldId} entryId={entryId} entryName={entry.name} entryTypeId={entry.typeId} canEdit={canEdit}/></div>

      <div className="section"><EntryComments worldId={worldId} entryId={entryId} role={role}/></div>

      {pageLink && <div><Link to={pageLink}>Open as a page</Link></div>}

      {!pageLink && canEdit && (
        <div>
          {!confirmingDelete && <button type="button" className="danger" onClick={() => setConfirmingDelete(true)}>Delete entry</button>}

          {confirmingDelete && (
            <div className="line">
              <span>Delete this entry?</span>

              <button type="button" className="danger" onClick={handleDelete}>Yes, delete</button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {!sideNotes && notes}
    </div>
  );

  if (!sideNotes) {
    return panel;
  }

  return (
    <div className={canEdit ? 'entry-frame with-side' : 'entry-frame'}>
      {panel}

      {canEdit && <aside className="entry-side">{notes}</aside>}
    </div>
  );
}
