import { useState } from 'react';
import { deleteRelationshipTypeRequest, updateRelationshipTypeRequest } from '../api/relationshipTypes';
import { countLabel } from '../utils/text';
import { sideText } from '../utils/relationships';
import RelationshipTypeForm from './RelationshipTypeForm';

export default function RelationshipTypeCell({worldId, type, entryTypes, canEdit, onChanged}) {
  const [mode, setMode] = useState('view');
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState('');

  function close() {
    setMode('view');
    setConfirmName('');
    setError('');
  }

  async function handleUpdate(data) {
    await updateRelationshipTypeRequest(worldId, type.id, data);
    close();
    await onChanged();
  }

  async function handleDelete(event) {
    event.preventDefault();
    setError('');

    try {
      await deleteRelationshipTypeRequest(worldId, type.id, confirmName);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  if (mode === 'edit') {
    return (
      <li className="cell open">
        <RelationshipTypeForm initial={type} entryTypes={entryTypes} submitLabel="Save changes" onSubmit={handleUpdate} onCancel={close}/>
      </li>
    );
  }

  if (mode === 'delete') {
    return (
      <li className="cell open">
        <div className="card-head"><h2>Delete {type.name}</h2></div>

        <p>{countLabel(type.relationshipCount, 'relationship uses', 'relationships use')} {type.name}. They will be removed.</p>

        <form className="inline-form" onSubmit={handleDelete}>
          <input type="text" aria-label="Type the relationship type name to confirm" placeholder={`Type ${type.name} to confirm`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

          <button type="submit" className="danger" disabled={confirmName !== type.name}>Delete type</button>
          <button type="button" onClick={close}>Cancel</button>

          {error && <p role="alert">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="cell">
      <div className="cell-name">{type.name}</div>

      <div className="cell-col scroll-x" data-label="From"><span className="scroll-text">{sideText(type.fromAny, type.fromTypeIds, entryTypes, true)}</span></div>

      <div className="cell-col scroll-x" data-label="To"><span className="scroll-text">{sideText(type.toAny, type.toTypeIds, entryTypes, true)}</span></div>

      <div className="cell-col desc-col" data-label="Description"><span className="desc-text">{type.description ? type.description : <span className="muted">None</span>}</span></div>

      <div className="cell-col" data-label="Used">{type.relationshipCount}</div>

      {canEdit && (
        <div className="cell-actions">
          <button type="button" onClick={() => setMode('edit')}>Edit</button>
          <button type="button" className="danger" onClick={() => setMode('delete')}>Delete</button>
        </div>
      )}
    </li>
  );
}
