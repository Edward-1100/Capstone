import { useState } from 'react';

export default function EntryForm({initial, types, submitLabel, onSubmit}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [typeId, setTypeId] = useState(initial.typeId || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await onSubmit({name, description, typeId: typeId || null});
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

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={submitting}>{submitLabel}</button>
    </form>
  );
}
