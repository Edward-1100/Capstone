import { useState } from 'react';

function SideChoice({legend, any, ids, entryTypes, onAny, onIds}) {
  function toggle(typeId) {
    onIds(ids.includes(typeId) ? ids.filter((item) => item !== typeId) : ids.concat([typeId]));
  }

  return (
    <fieldset>
      <legend>{legend}</legend>

      <label><input type="radio" checked={any} onChange={() => onAny(true)}/> Any entry type</label>
      <label><input type="radio" checked={!any} onChange={() => onAny(false)}/> Only these entry types</label>

      {!any && entryTypes.map((type) => (
        <label key={type.id}><input type="checkbox" checked={ids.includes(type.id)} onChange={() => toggle(type.id)}/> {type.name}</label>
      ))}
    </fieldset>
  );
}

export default function RelationshipTypeForm({initial, entryTypes, editing, submitLabel, onSubmit, onCancel}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [symmetric, setSymmetric] = useState(initial.symmetric);
  const [fromAny, setFromAny] = useState(initial.fromAny);
  const [fromIds, setFromIds] = useState(initial.fromTypeIds);
  const [toAny, setToAny] = useState(initial.toAny);
  const [toIds, setToIds] = useState(initial.toTypeIds);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(confirmRemove) {
    setError('');
    setSubmitting(true);

    const data = {name, description, fromAny, fromTypeIds: fromAny ? undefined : fromIds, toAny, toTypeIds: toAny ? undefined : toIds};

    if (!editing) {
      data.symmetric = symmetric;
    }

    if (confirmRemove) {
      data.confirmRemove = true;
    }

    try {
      await onSubmit(data);
    } catch (err) {
      if (err.status === 409 && err.data && err.data.relationships) {
        setPending(err.data);
      } else {
        setError(err.message);
      }

      setSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setPending(null);
    submit(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="relName">Name</label>
        <input id="relName" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required/>
      </div>

      <div>
        <label htmlFor="relDescription">Description</label>
        <textarea id="relDescription" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500}/>
      </div>

      <div>
        <label htmlFor="relSymmetric">Works both ways, like Friend</label>
        <input id="relSymmetric" type="checkbox" checked={symmetric} onChange={(e) => setSymmetric(e.target.checked)} disabled={editing}/>

        {editing && <span>This can not be changed</span>}
      </div>

      <SideChoice legend="First entry can be" any={fromAny} ids={fromIds} entryTypes={entryTypes} onAny={setFromAny} onIds={setFromIds}/>

      <SideChoice legend="Second entry can be" any={toAny} ids={toIds} entryTypes={entryTypes} onAny={setToAny} onIds={setToIds}/>

      {error && <p role="alert">{error}</p>}

      {pending && (
        <div>
          <p role="alert">{pending.message}:</p>

          <ul>
            {pending.relationships.map((item) => <li key={item.id}>{item.fromName} {item.typeName} {item.toName}</li>)}
          </ul>

          {pending.count > pending.relationships.length && <p>and {pending.count - pending.relationships.length} more</p>}

          <button type="button" onClick={() => submit(true)} disabled={submitting}>Remove them and save</button>
        </div>
      )}

      <button type="submit" disabled={submitting}>{submitLabel}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}
