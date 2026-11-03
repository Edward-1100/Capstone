import { useState } from 'react';
import { createFieldRequest, deleteFieldRequest, updateFieldRequest } from '../api/entryTypes';
import { countLabel } from '../utils/text';
import { describeField } from '../utils/fields';
import FieldForm from './FieldForm';

const MAX_FIELDS = 33;

export default function TypeFields({worldId, type, canEdit, onChanged}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingField, setDeletingField] = useState(null);
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState('');

  async function handleCreate(data) {
    await createFieldRequest(worldId, type.id, {name: data.name, fieldType: data.fieldType, required: data.required, config: data.config});
    setAdding(false);
    await onChanged();
  }

  async function handleUpdate(fieldId, data) {
    await updateFieldRequest(worldId, type.id, fieldId, {name: data.name, required: data.required, config: data.config, confirmClear: data.confirmClear});
    setEditingId(null);
    await onChanged();
  }

  function startDelete(field) {
    setError('');
    setDeletingField(field);
    setConfirmName('');
  }

  async function handleDelete(event) {
    event.preventDefault();
    setError('');

    try {
      await deleteFieldRequest(worldId, type.id, deletingField.id, confirmName);
      setDeletingField(null);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {type.fields.length === 0 && <p className="muted">No fields yet</p>}

      <ul className="rows">
        {type.fields.map((field) => (
          <li key={field.id} className={editingId === field.id ? 'open' : ''}>
            {editingId !== field.id && (
              <>
                <span className="kind">{field.name}</span>

                <span className="other">{describeField(field)}{field.required && ', required'}, {countLabel(field.usageCount, 'entry has', 'entries have')} a value</span>

                {canEdit && (
                  <span className="row-actions">
                    <button type="button" onClick={() => setEditingId(field.id)}>Edit</button>
                    <button type="button" className="danger" onClick={() => startDelete(field)}>Delete</button>
                  </span>
                )}
              </>
            )}

            {editingId === field.id && <FieldForm initial={field} editing submitLabel="Save field" onSubmit={(data) => handleUpdate(field.id, data)} onCancel={() => setEditingId(null)}/>}
          </li>
        ))}
      </ul>

      {canEdit && !adding && type.fields.length < MAX_FIELDS && <button type="button" onClick={() => setAdding(true)}>Add field</button>}

      {canEdit && type.fields.length >= MAX_FIELDS && <p className="muted">A type can have up to {MAX_FIELDS} fields</p>}

      {adding && <FieldForm initial={{name: '', fieldType: 'text', required: false, config: {}}} submitLabel="Add field" onSubmit={handleCreate} onCancel={() => setAdding(false)}/>}

      {deletingField && (
        <form className="confirm" onSubmit={handleDelete}>
          <p>{countLabel(deletingField.usageCount, 'entry has', 'entries have')} a value for {deletingField.name}. It will be removed from them.</p>

          <div className="inline-form">
            <input type="text" aria-label="Type the field name to confirm" placeholder={`Type ${deletingField.name} to confirm`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

            <button type="submit" className="danger" disabled={confirmName !== deletingField.name}>Delete field</button>
            <button type="button" onClick={() => setDeletingField(null)}>Cancel</button>
          </div>

          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}
