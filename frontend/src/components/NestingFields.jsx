import TypeSelect from './TypeSelect';

const MODES = [
  {value: 'none', label: 'Can not be nested'},
  {value: 'chosen', label: 'Inside specific types'},
  {value: 'all', label: 'Inside any type'},
  {value: 'own', label: 'Inside its own type only'},
];

export default function NestingFields({name, types, mode, parentTypeIds, onMode, onParentTypeIds}) {
  return (
    <div className="nesting-fields">
      <div className="mode-options" role="radiogroup" aria-label="Nesting">
        {MODES.map((item) => (
          <label key={item.value} className={mode === item.value ? 'mode-option selected' : 'mode-option'}>
            <input type="radio" name={name} checked={mode === item.value} onChange={() => onMode(item.value)}/>
            {item.label}
          </label>
        ))}
      </div>

      {mode === 'chosen' && (
        <div>
          <b>Types it can go inside</b>

          <TypeSelect types={types} selectedIds={parentTypeIds} onChange={onParentTypeIds} label="Add a type it can go inside"/>
        </div>
      )}
    </div>
  );
}
