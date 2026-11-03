import { useState } from 'react';
import { deleteRelationshipTypeRequest, updateRelationshipTypeRequest } from '../api/relationshipTypes';
import { countLabel } from '../utils/text';
import { describeSide } from '../utils/relationships';
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

      <div className="cell-info">
        <p>{describeSide(type.fromAny, type.fromTypeIds, entryTypes)} to {describeSide(type.toAny, type.toTypeIds, entryTypes)}</p>
        <p>{countLabel(type.relationshipCount, 'relationship', 'relationships')}</p>
        {type.description && <p>{type.description}</p>}
      </div>

      {canEdit && (
        <div className="cell-actions">
          <button type="button" onClick={() => setMode('edit')}>Edit</button>
          <button type="button" className="danger" onClick={() => setMode('delete')}>Delete</button>
        </div>
      )}
    </li>
  );
}
