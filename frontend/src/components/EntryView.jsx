import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteEntryRequest, getEntryRequest, listEntriesRequest, updateEntryRequest } from '../api/entries';
import { listEntryTypesRequest } from '../api/entryTypes';
import { formatValue } from '../utils/fields';
import EntryComments from './EntryComments';
import EntryGallery from './EntryGallery';
import EntryNotes from './EntryNotes';
import EntryRelationships from './EntryRelationships';
import EntryTags from './EntryTags';
import FieldInput from './FieldInput';
import LinkedText from './LinkedText';
import LinkTextarea from './LinkTextarea';

export default function EntryView({worldId, entryId, role, onDeleted}) {
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
  const [conflict, setConflict] = useState(false);
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

  function startEdit(section) {
    setError('');
    setConflict(false);
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
    setConflict(false);
    setUnlink(null);
  }

  async function save(changes) {
    setError('');
    setConflict(false);

    try {
      setEntry(await updateEntryRequest(worldId, entryId, Object.assign({version: entry.version}, changes)));
      setUnlink(null);
      setEditing('');
    } catch (err) {
      if (err.status === 409 && err.data && err.data.links) {
        setUnlink(err.data);
      } else if (err.status === 409) {
        setConflict(true);
      } else {
        setError(err.message);
      }
    }
  }

  async function handleLoadLatest() {
    setConflict(false);

    try {
      setEntry(await getEntryRequest(worldId, entryId));
    } catch (err) {
      setError(err.message);
    }
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

  return (
    <div className="panel">
      <div>
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
      </div>

      {(error || conflict || unlink) && (
        <div>
          {error && <p role="alert">{error}</p>}

          {conflict && <p role="alert">Someone else changed this entry. Your edit is kept, so you can load the latest version and save again. <button type="button" onClick={handleLoadLatest}>Load latest</button></p>}

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

      <EntryGallery worldId={worldId} entryId={entryId} entryName={entry.name} images={entry.images} canEdit={canEdit} onChange={setEntry}/>

      <div>
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

      {entry.typeFields.length > 0 && (
        <div>
          <div className="line">
            <h2>Details</h2>

            {canEdit && editing !== 'fields' && <button type="button" onClick={() => startEdit('fields')}>Edit</button>}
          </div>

          {editing !== 'fields' && (
            <dl className="facts">
              {entry.typeFields.map((definition) => (
                <Fragment key={definition.id}>
                  <dt>{definition.name}</dt>
                  <dd>{formatValue(definition, entry.fields[definition.id]) || 'not set'}</dd>
                </Fragment>
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

      <EntryTags worldId={worldId} entryId={entryId} canEdit={canEdit}/>

      <EntryRelationships worldId={worldId} entryId={entryId} entryTypeId={entry.typeId} canEdit={canEdit}/>

      {canEdit && <EntryNotes worldId={worldId} entryId={entryId} role={role}/>}

      <EntryComments worldId={worldId} entryId={entryId} role={role}/>

      {canEdit && (
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
    </div>
  );
}
