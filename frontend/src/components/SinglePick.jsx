import Typeahead from './Typeahead';

export default function SinglePick({options, value, onChange, placeholder, label, missing = 'Deleted'}) {
  const chosen = options.find((option) => option.id === value);

  if (value) {
    return (
      <span className="chip single-chip">
        {chosen ? chosen.label : missing}

        <button type="button" aria-label={`Clear ${label}`} onClick={() => onChange('')}>&times;</button>
      </span>
    );
  }

  return (
    <span className="single-pick">
      <Typeahead options={options} onPick={onChange} placeholder={placeholder} label={label} showCount={false}/>
    </span>
  );
}
