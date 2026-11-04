import { useState } from 'react';
import FieldInput from './FieldInput';

export default function EntryForm({initial, types, submitLabel, onSubmit}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [typeId, setTypeId] = useState(initial.typeId || '');
  const [values, setValues] = useState(initial.fields || {});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedType = types.find((type) => type.id === typeId);
  const definitions = selectedType ? selectedType.fields : [];

  function setValue(fieldId, value) {
    setValues(Object.assign({}, values, {[fieldId]: value}));
  }

  function buildFields() {
    const fields = {};

    for (const definition of definitions) {
      const value = values[definition.id];
      const blank = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

      fields[definition.id] = blank ? null : value;
    }

    return fields;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await onSubmit({name, description, typeId: typeId || null, fields: buildFields()});
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required/>
      </div>

      <div>
        <label htmlFor="type">Type</label>

        <select id="type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">No type</option>
          {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="description">Description</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={20000}/>
      </div>

      {definitions.map((definition) => (
        <div key={definition.id}>
          <label htmlFor={`field-${definition.id}`}>{definition.name}{definition.required && ' (required)'}</label>
          <FieldInput definition={definition} value={values[definition.id]} onChange={(value) => setValue(definition.id, value)}/>
        </div>
      ))}

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={submitting}>{submitLabel}</button>
    </form>
  );
}
