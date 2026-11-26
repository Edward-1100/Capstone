import PickBox from './PickBox';

export default function TypeSelect({types, selectedIds, onChange, placeholder = 'Search to add a type', label = 'Add a type'}) {
  const options = types.map((type) => ({id: type.id, label: type.name}));
  const known = selectedIds.filter((id) => types.some((type) => type.id === id));

  return (
    <div className="type-select">
      <PickBox options={options} selected={known} placeholder={placeholder} label={label} onAdd={(id) => onChange(known.concat([id]))} onRemove={(id) => onChange(known.filter((item) => item !== id))}/>

      <div className="type-select-meta">
        <span className="muted">{known.length} of {types.length}</span>

        <span className="picker-bulk">
          {known.length < types.length && <button type="button" className="link" onClick={() => onChange(types.map((type) => type.id))}>Add all</button>}
          {known.length > 0 && <button type="button" className="link" onClick={() => onChange([])}>Clear all</button>}
        </span>
      </div>
    </div>
  );
}
