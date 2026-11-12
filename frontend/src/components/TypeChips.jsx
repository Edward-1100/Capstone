import Typeahead from './Typeahead';

export default function TypeChips({selected, available, onAdd, onRemove, emptyText, label}) {
  return (
    <div className="tagbox">
      {selected.length === 0 && <span className="muted">{emptyText}</span>}

      {selected.map((type) => (
        <span key={type.id} className="chip">
          {type.name}

          <button type="button" aria-label={`Remove ${type.name}`} onClick={() => onRemove(type.id)}>&times;</button>
        </span>
      ))}

      {available.length > 0 && <Typeahead options={available.map((type) => ({id: type.id, label: type.name}))} onPick={onAdd} showCount={false} placeholder={label} label={label}/>}
    </div>
  );
}
