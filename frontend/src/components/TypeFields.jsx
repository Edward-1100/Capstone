import { useState } from 'react';
import { createFieldRequest, deleteFieldRequest, updateFieldRequest } from '../api/entryTypes';
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
      <h3>Fields for {type.name}</h3>

      {type.fields.length === 0 && <p>No fields yet</p>}

      <ul>
        {type.fields.map((field) => (
          <li key={field.id}>
            {editingId !== field.id && <span>{field.name}: {describeField(field)}{field.required && ', required'}, {field.usageCount} entries have a value</span>}

            {editingId === field.id && <FieldForm initial={field} editing submitLabel="Save field" onSubmit={(data) => handleUpdate(field.id, data)} onCancel={() => setEditingId(null)}/>}

            {canEdit && editingId !== field.id && <button onClick={() => setEditingId(field.id)}>Edit field</button>}

            {canEdit && editingId !== field.id && <button onClick={() => startDelete(field)}>Delete field</button>}
          </li>
        ))}
      </ul>

      {canEdit && !adding && type.fields.length < MAX_FIELDS && <button onClick={() => setAdding(true)}>Add field</button>}

      {canEdit && type.fields.length >= MAX_FIELDS && <p>A type can have up to {MAX_FIELDS} fields</p>}

      {adding && <FieldForm initial={{name: '', fieldType: 'text', required: false, config: {}}} submitLabel="Add field" onSubmit={handleCreate} onCancel={() => setAdding(false)}/>}

      {deletingField && (
        <section>
          <h4>Delete {deletingField.name}</h4>

          <p>{deletingField.usageCount} entries have a value for this field. It will be removed from them.</p>

          <form onSubmit={handleDelete}>
            <p>Type the field's name ({deletingField.name}) to confirm.</p>

            <input type="text" value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

            {error && <p role="alert">{error}</p>}

            <button type="submit" disabled={confirmName !== deletingField.name}>Delete field</button>
            <button type="button" onClick={() => setDeletingField(null)}>Cancel</button>
          </form>
        </section>
      )}
    </div>
  );
}
