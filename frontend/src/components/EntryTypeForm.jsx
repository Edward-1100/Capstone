import { useState } from 'react';
import NestingFields from './NestingFields';

export default function EntryTypeForm({types, onSubmit, onCancel}) {
  const [name, setName] = useState('');
  const [mappable, setMappable] = useState(false);
  const [timelineable, setTimelineable] = useState(false);
  const [nestMode, setNestMode] = useState('none');
  const [parentTypeIds, setParentTypeIds] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (nestMode === 'chosen' && parentTypeIds.length === 0) {
      setError('Choose at least one type');

      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({name, mappable, timelineable, nestMode, parentTypeIds});
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form className="type-form" onSubmit={handleSubmit}>
      <div className="card-head"><h2>New entry type</h2></div>

      <div>
        <label htmlFor="newTypeName">Name</label>
        <input id="newTypeName" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required autoFocus/>
      </div>

      <div className="check-row">
        <label className="check"><input type="checkbox" checked={mappable} onChange={(e) => setMappable(e.target.checked)}/> Can be placed on maps</label>
        <label className="check"><input type="checkbox" checked={timelineable} onChange={(e) => setTimelineable(e.target.checked)}/> Can be placed on timeline</label>
      </div>

      <NestingFields name="newTypeNest" types={types} mode={nestMode} parentTypeIds={parentTypeIds} onMode={setNestMode} onParentTypeIds={setParentTypeIds}/>

      {error && <p role="alert">{error}</p>}

      <div className="actions">
        <button type="submit" className="primary" disabled={submitting}>Create type</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
