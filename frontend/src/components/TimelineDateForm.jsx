import { useState } from 'react';
import { DATE_PARTS, MAX_YEAR, MIN_YEAR, daysInMonth, datePayload, formatSpan } from '../utils/timeline';

const PARTS = [
  {name: 'Year', label: 'Year', hint: '-1M to 1M', min: MIN_YEAR, max: MAX_YEAR},
  {name: 'Month', label: 'Month', hint: '1-12', min: 1, max: 12},
  {name: 'Day', label: 'Day', hint: '1-31', min: 1, max: 31},
  {name: 'Hour', label: 'Hour', hint: '0-23', min: 0, max: 23},
  {name: 'Minute', label: 'Min', hint: '0-59', min: 0, max: 59},
];

function DateFields({prefix, values, onChange, required}) {
  const year = values[`${prefix}Year`].trim();
  const month = values[`${prefix}Month`].trim();
  const lastDay = year !== '' && month !== '' ? daysInMonth(Number(year), Number(month)) : 31;

  function unlocked(index) {
    for (let before = 0; before < index; before += 1) {
      if (values[prefix + PARTS[before].name].trim() === '') {
        return false;
      }
    }

    return true;
  }

  return (
    <div className="date-fields">
      {PARTS.map((part, index) => (
        <label key={part.name} className={index === 0 ? 'date-year' : ''}>
          {part.label}
          <input type="number" value={values[prefix + part.name]} placeholder={part.hint} disabled={!unlocked(index)} onChange={(e) => onChange(prefix + part.name, e.target.value)} min={part.min} max={part.name === 'Day' ? lastDay : part.max} step="1" required={required && index === 0}/>
        </label>
      ))}
    </div>
  );
}

export default function TimelineDateForm({initialValues, submitLabel, onSubmit, onCancel}) {
  const [values, setValues] = useState(initialValues);
  const [ranged, setRanged] = useState(initialValues.endYear.trim() !== '');
  const [error, setError] = useState('');

  function change(name, value) {
    const next = Object.assign({}, values, {[name]: value});
    const prefix = name.startsWith('start') ? 'start' : 'end';
    const index = DATE_PARTS.findIndex((part) => prefix + part.name === name);

    if (value.trim() === '') {
      for (const part of DATE_PARTS.slice(index + 1)) {
        next[prefix + part.name] = '';
      }
    }

    setValues(next);
  }

  function effective() {
    const next = Object.assign({}, values);

    if (!ranged) {
      for (const part of DATE_PARTS) {
        next[`end${part.name}`] = '';
      }
    }

    return datePayload(next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      await onSubmit(effective());
    } catch (err) {
      setError(err.message);
    }
  }

  const payload = effective();

  return (
    <form className="timeline-form" onSubmit={handleSubmit}>
      <fieldset>
        <legend>When</legend>

        <DateFields prefix="start" values={values} onChange={change} required={true}/>
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={ranged} onChange={(e) => setRanged(e.target.checked)}/>
        End date
      </label>

      {ranged && (
        <fieldset>
          <legend>End date</legend>

          <DateFields prefix="end" values={values} onChange={change} required={false}/>
        </fieldset>
      )}

      <p className="muted">{payload.startYear === null ? 'Enter a year to place it' : `Shown as ${formatSpan(payload)}`}</p>

      <div className="actions">
        <button type="submit" className="primary">{submitLabel}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>

      {error && <p role="alert">{error}</p>}
    </form>
  );
}
