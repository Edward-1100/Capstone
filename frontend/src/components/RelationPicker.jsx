import { useState } from 'react';
import Typeahead from './Typeahead';

export function describeRelation(value, relationshipTypes, entries) {
  const [typeId, side, entryId] = value.split(':');
  const type = relationshipTypes.find((item) => item.id === typeId);
  const entry = entries.find((item) => item.id === entryId);

  return `${type ? type.name : 'deleted type'} ${side} ${entry ? entry.name : 'deleted entry'}`;
}

export default function RelationPicker({relationshipTypes, entries, selected, onAdd, onRemove, label}) {
  const [typeId, setTypeId] = useState('');
  const [side, setSide] = useState('to');

  const options = entries.map((entry) => ({id: entry.id, label: entry.name, count: entry.relationshipCount}));

  function handlePick(entryId) {
    if (typeId) {
      onAdd(`${typeId}:${side}:${entryId}`);
    }
  }

  return (
    <div className="pick-box">
      {selected.map((value) => (
        <span key={value} className="chip">
          {describeRelation(value, relationshipTypes, entries)}

          <button type="button" aria-label={`Remove ${describeRelation(value, relationshipTypes, entries)}`} onClick={() => onRemove(value)}>&times;</button>
        </span>
      ))}

      <div className="relation-controls">
        <select className="small" aria-label={`${label} relationship type`} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Relationship type</option>
          {relationshipTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>

        <select className="small" aria-label={`${label} direction`} value={side} onChange={(e) => setSide(e.target.value)}>
          <option value="to">to</option>
          <option value="from">from</option>
        </select>

        {typeId ? <Typeahead options={options.filter((option) => !selected.includes(`${typeId}:${side}:${option.id}`))} onPick={handlePick} placeholder="Type an entry" label={`${label} entry`}/> : <span className="muted">Choose a type first</span>}
      </div>
    </div>
  );
}
