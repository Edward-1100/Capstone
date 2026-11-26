import { useState } from 'react';
import TypeSelect from './TypeSelect';

function SideChoice({title, any, ids, entryTypes, onAny, onIds}) {
  return (
    <div className="side-box">
      <h3>{title}</h3>

      <label className="check"><input type="checkbox" checked={any} onChange={(e) => onAny(e.target.checked)}/> Any entry type</label>

      {!any && <TypeSelect types={entryTypes} selectedIds={ids} onChange={onIds} label={`Add a type for ${title}`}/>}
    </div>
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
    <form className="rel-form" onSubmit={handleSubmit}>
      <div className="card-head"><h2>{initial.name ? 'Edit relationship type' : 'New relationship type'}</h2></div>

      <div>
        <label htmlFor="relName">Name</label>
        <input id="relName" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required autoFocus/>
      </div>

      <div>
        <label htmlFor="relDescription">Description</label>
        <textarea id="relDescription" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500}/>
      </div>

      <div className="side-grid">
        <SideChoice title="First entry can be" any={fromAny} ids={fromIds} entryTypes={entryTypes} onAny={setFromAny} onIds={setFromIds}/>

        <SideChoice title="Second entry can be" any={toAny} ids={toIds} entryTypes={entryTypes} onAny={setToAny} onIds={setToIds}/>
      </div>

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
        <button type="submit" className="primary" disabled={submitting}>{submitLabel}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
