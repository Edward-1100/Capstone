import { stepLabel } from '../utils/fields';
import LinkTextarea from './LinkTextarea';

export default function FieldInput({definition, value, onChange, entries}) {
  const id = `field-${definition.id}`;
  const config = definition.config || {};
  const type = definition.fieldType;
  const empty = value === undefined || value === null;

  if (type === 'text' && entries) {
    return <LinkTextarea single id={id} label={definition.name} value={empty ? '' : value} onChange={onChange} maxLength={500} entries={entries}/>;
  }

  if (type === 'text') {
    return <input id={id} type="text" value={empty ? '' : value} onChange={(e) => onChange(e.target.value)} maxLength={500}/>;
  }

  if (type === 'long_text' && entries) {
    return <LinkTextarea id={id} label={definition.name} value={empty ? '' : value} onChange={onChange} maxLength={20000} entries={entries}/>;
  }

  if (type === 'long_text') {
    return <textarea id={id} value={empty ? '' : value} onChange={(e) => onChange(e.target.value)} maxLength={20000}/>;
  }

  if (type === 'number') {
    return <input id={id} type="number" step="any" value={empty ? '' : value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}/>;
  }

  if (type === 'boolean') {
    const current = value === true ? 'true' : (value === false ? 'false' : '');

    return (
      <select id={id} value={current} onChange={(e) => onChange(e.target.value === 'true' ? true : (e.target.value === 'false' ? false : ''))}>
        <option value="">Not set</option>
        <option value="true">{config.trueLabel}</option>
        <option value="false">{config.falseLabel}</option>
      </select>
    );
  }

  if (type === 'scale') {
    const label = empty || value === '' ? '' : stepLabel(config, value);

    return (
      <span className="scale-input">
        <input id={id} type="number" step="1" min={config.min} max={config.max} placeholder={`${config.min} to ${config.max}`} value={empty ? '' : value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}/>

        {label !== '' && label !== String(value) && <span className="muted">{label.slice(String(value).length + 3)}</span>}
      </span>
    );
  }

  if (type === 'choice') {
    return (
      <select id={id} value={empty ? '' : value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not set</option>
        {(config.options || []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    );
  }

  const selected = Array.isArray(value) ? value : [];

  function toggle(optionId) {
    onChange(selected.includes(optionId) ? selected.filter((item) => item !== optionId) : selected.concat([optionId]));
  }

  return (
    <span id={id} className="multi-options">
      {(config.options || []).map((option) => (
        <label key={option.id} className={selected.includes(option.id) ? 'multi-option selected' : 'multi-option'}>
          <input type="checkbox" checked={selected.includes(option.id)} onChange={() => toggle(option.id)}/>
          {option.label}
        </label>
      ))}
    </span>
  );
}
