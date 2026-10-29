import { scaleSteps, stepLabel } from '../utils/fields';

export default function FieldInput({definition, value, onChange}) {
  const id = `field-${definition.id}`;
  const config = definition.config || {};
  const type = definition.fieldType;
  const empty = value === undefined || value === null;

  if (type === 'text') {
    return <input id={id} type="text" value={empty ? '' : value} onChange={(e) => onChange(e.target.value)} maxLength={500}/>;
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
    const steps = scaleSteps(config);
    const outside = !empty && value !== '' && !steps.includes(value);

    return (
      <select id={id} value={empty ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}>
        <option value="">Not set</option>
        {outside && <option value={String(value)}>{value} (outside the range)</option>}
        {steps.map((step) => <option key={step} value={String(step)}>{stepLabel(config, step)}</option>)}
      </select>
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
    <span id={id}>
      {(config.options || []).map((option) => (
        <label key={option.id}>
          <input type="checkbox" checked={selected.includes(option.id)} onChange={() => toggle(option.id)}/>
          {option.label}
        </label>
      ))}
    </span>
  );
}
