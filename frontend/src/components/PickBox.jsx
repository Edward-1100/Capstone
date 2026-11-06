import Typeahead from './Typeahead';

export default function PickBox({options, selected, onAdd, onRemove, placeholder, label}) {
  const chosen = selected.map((id) => options.find((option) => option.id === id)).filter((option) => option !== undefined);
  const available = options.filter((option) => !selected.includes(option.id));

  return (
    <div className="pick-box">
      {chosen.map((option) => (
        <span key={option.id} className="chip">
          {option.swatch}{option.label}

          <button type="button" aria-label={`Remove ${option.label}`} onClick={() => onRemove(option.id)}>&times;</button>
        </span>
      ))}

      <Typeahead options={available} onPick={onAdd} placeholder={placeholder} label={label}/>
    </div>
  );
}
