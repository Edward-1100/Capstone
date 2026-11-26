import { useState } from 'react';
import TagRules from './TagRules';
import TagSwatch from './TagSwatch';

export default function TagForm({worldId, initial, submitLabel, onSubmit, onCancel, withRule = false}) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color || null);
  const [tab, setTab] = useState('details');
  const [rule, setRule] = useState({match: 'all', conditions: [], complete: true});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (withRule && !rule.complete) {
      setTab('rule');
      setError('Finish or remove the unfinished rule conditions');

      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({name, color}, withRule && rule.conditions.length > 0 ? {match: rule.match, conditions: rule.conditions} : null);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form className="tag-form" onSubmit={handleSubmit}>
      {!initial.name && <div className="card-head"><h2>New tag</h2></div>}

      {withRule && (
        <div className="panel-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>Details</button>
          <button type="button" role="tab" aria-selected={tab === 'rule'} className={tab === 'rule' ? 'on' : ''} onClick={() => setTab('rule')}>Rule</button>
        </div>
      )}

      <div hidden={tab !== 'details'} className="tag-details">
        <div>
          <label htmlFor="tagName">Name</label>
          <input id="tagName" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required autoFocus/>
        </div>

        <div>
          <label>Color</label>

          <div className="swatches">
            <button type="button" className={color === null ? 'swatch-pick none selected' : 'swatch-pick none'} aria-label="No color" aria-pressed={color === null} onClick={() => setColor(null)}>x</button>

            <input type="color" aria-label="Custom color" value={color || '#808080'} onChange={(e) => setColor(e.target.value)}/>
          </div>
        </div>

        <p className="tag-preview"><span className="chip"><TagSwatch color={color}/>{name.trim() === '' ? 'Tag name' : name.trim()}</span></p>
      </div>

      {withRule && tab === 'rule' && <TagRules worldId={worldId} tag={{id: 'new'}} canEdit={true} draft={true} onDraft={setRule} onChanged={() => undefined}/>}

      {error && <p role="alert">{error}</p>}

      <div className="actions">
        <button type="submit" className="primary" disabled={submitting}>{submitLabel}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
