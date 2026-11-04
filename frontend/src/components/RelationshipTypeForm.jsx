import { useState } from 'react';

function SideChoice({legend, any, ids, entryTypes, onAny, onIds}) {
  const chosen = entryTypes.filter((type) => ids.includes(type.id));
  const available = entryTypes.filter((type) => !ids.includes(type.id));

  function handleAdd(event) {
    if (event.target.value) {
      onIds(ids.concat([event.target.value]));
    }
  }

  return (
    <fieldset>
      <legend>{legend}</legend>

      <label><input type="radio" checked={any} onChange={() => onAny(true)}/> Any entry type</label>
      <label><input type="radio" checked={!any} onChange={() => onAny(false)}/> Specific entry types</label>

      {!any && (
        <div className="tagbox">
          {chosen.map((type) => (
            <span key={type.id} className="chip">
              {type.name}

              <button type="button" aria-label={`Remove ${type.name}`} onClick={() => onIds(ids.filter((item) => item !== type.id))}>&times;</button>
            </span>
          ))}

          {available.length > 0 && (
            <select aria-label="Add an entry type" value="" onChange={handleAdd}>
              <option value="">Add an entry type</option>
              {available.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          )}
        </div>
      )}
    </fieldset>
  );
}

export default function RelationshipTypeForm({initial, entryTypes, submitLabel, onSubmit, onCancel}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
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

          <button type="button" className="danger" onClick={() => submit(true)} disabled={submitting}>Remove them and save</button>
        </div>
      )}

      <div className="actions">
        <button type="submit" disabled={submitting}>{submitLabel}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
