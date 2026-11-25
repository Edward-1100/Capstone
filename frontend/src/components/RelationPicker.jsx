import { useState } from 'react';
import SinglePick from './SinglePick';
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

  const typeOptions = relationshipTypes.map((type) => ({id: type.id, label: type.name}));

  return (
    <div className="pick-box relation-picker">
      <div className="relation-controls">
        <SinglePick options={typeOptions} value={typeId} onChange={setTypeId} placeholder="Search for a relationship type" label={`${label} relationship type`}/>

        <div className="toggle" role="group" aria-label={`${label} direction`}>
          <button type="button" className={side === 'to' ? 'on' : ''} onClick={() => setSide('to')}>To</button>
          <button type="button" className={side === 'from' ? 'on' : ''} onClick={() => setSide('from')}>From</button>
          <button type="button" className={side === 'either' ? 'on' : ''} onClick={() => setSide('either')}>Either</button>
        </div>

        {typeId ? <Typeahead options={options.filter((option) => !selected.includes(`${typeId}:${side}:${option.id}`))} onPick={handlePick} placeholder="Search for an entry" label={`${label} entry`}/> : <span className="muted">Pick a type, then an entry</span>}
      </div>

      {selected.length > 0 && (
        <div className="pick-chips">
          {selected.map((value) => (
            <span key={value} className="chip">
              {describeRelation(value, relationshipTypes, entries)}

              <button type="button" aria-label={`Remove ${describeRelation(value, relationshipTypes, entries)}`} onClick={() => onRemove(value)}>&times;</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
