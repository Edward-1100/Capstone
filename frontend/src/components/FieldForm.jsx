import { useState } from 'react';
import { FIELD_TYPE_LABELS, scaleSteps } from '../utils/fields';

export default function FieldForm({initial, editing, submitLabel, onSubmit, onCancel}) {
  const config = initial.config || {};

  const [name, setName] = useState(initial.name);
  const [fieldType, setFieldType] = useState(initial.fieldType);
  const [required, setRequired] = useState(initial.required);
  const [trueLabel, setTrueLabel] = useState(config.trueLabel || 'True');
  const [falseLabel, setFalseLabel] = useState(config.falseLabel || 'False');
  const [min, setMin] = useState(config.min === undefined ? '1' : String(config.min));
  const [max, setMax] = useState(config.max === undefined ? '10' : String(config.max));
  const [labelRows, setLabelRows] = useState(Object.keys(config.labels || {}).map(Number).sort((a, b) => a - b).map((step) => ({step: String(step), name: config.labels[String(step)]})));
  const [options, setOptions] = useState(config.options || [{label: ''}, {label: ''}]);
  const [error, setError] = useState('');
  const [pendingClear, setPendingClear] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const minNumber = Number(min);
  const maxNumber = Number(max);
  const scaleValid = min !== '' && max !== '' && Number.isInteger(minNumber) && Number.isInteger(maxNumber) && minNumber < maxNumber && maxNumber - minNumber < 100;
  const steps = scaleValid ? scaleSteps({min: minNumber, max: maxNumber}) : [];

  function setOptionLabel(index, value) {
    setOptions(options.map((option, position) => (position === index ? Object.assign({}, option, {label: value}) : option)));
  }

  function setLabelRow(index, changes) {
    setLabelRows(labelRows.map((row, position) => (position === index ? Object.assign({}, row, changes) : row)));
  }

  function buildLabels() {
    const labels = {};

    for (const row of labelRows) {
      if (row.name.trim() !== '') {
        labels[row.step] = row.name;
      }
    }

    return labels;
  }

  function buildConfig() {
    if (fieldType === 'boolean') {
      return {trueLabel, falseLabel};
    }

    if (fieldType === 'scale') {
      return {min: minNumber, max: maxNumber, labels: buildLabels()};
    }

    if (fieldType === 'choice' || fieldType === 'multi_choice') {
      return {options: options.filter((option) => option.label.trim() !== '')};
    }

    return undefined;
  }

  async function submit(confirmClear) {
    setError('');

    if (fieldType === 'scale' && !scaleValid) {
      setError('A scale needs a whole number minimum and a higher maximum, up to 100 steps');

      return;
    }

    if (fieldType === 'scale' && labelRows.some((row) => row.name.trim() !== '' && !steps.includes(Number(row.step)))) {
      setError(`Names must be for a number from ${minNumber} to ${maxNumber}`);

      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({name, fieldType, required, config: buildConfig(), confirmClear});
    } catch (err) {
      if (err.status === 409 && err.data && err.data.affectedEntries) {
        setPendingClear(err.data.affectedEntries);
      } else {
        setError(err.message);
      }

      setSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setPendingClear(null);
    submit(false);
  }

  return (
    <form className="field-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div>
          <label htmlFor="fieldName">Field name</label>
          <input id="fieldName" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required/>
        </div>

        <div>
          <label htmlFor="fieldType">Field type</label>

          <select id="fieldType" value={fieldType} onChange={(e) => setFieldType(e.target.value)} disabled={editing}>
            {Object.keys(FIELD_TYPE_LABELS).map((key) => <option key={key} value={key}>{FIELD_TYPE_LABELS[key]}</option>)}
          </select>

          {editing && <small className="muted">The type can not be changed</small>}
        </div>
      </div>

      <label className="check"><input id="fieldRequired" type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)}/> Required</label>

      {fieldType === 'boolean' && (
        <div className="form-grid">
          <div>
            <label htmlFor="trueLabel">Name for true</label>
            <input id="trueLabel" type="text" value={trueLabel} onChange={(e) => setTrueLabel(e.target.value)} maxLength={50} required/>
          </div>

          <div>
            <label htmlFor="falseLabel">Name for false</label>
            <input id="falseLabel" type="text" value={falseLabel} onChange={(e) => setFalseLabel(e.target.value)} maxLength={50} required/>
          </div>
        </div>
      )}

      {fieldType === 'scale' && (
        <>
          <div className="form-grid">
            <div>
              <label htmlFor="scaleMin">Lowest number</label>
              <input id="scaleMin" type="number" value={min} onChange={(e) => setMin(e.target.value)} required/>
            </div>

            <div>
              <label htmlFor="scaleMax">Highest number</label>
              <input id="scaleMax" type="number" value={max} onChange={(e) => setMax(e.target.value)} required/>
            </div>
          </div>

          <div className="option-rows">
            <b>Names for numbers</b>

            {labelRows.map((row, index) => (
              <div key={index} className="option-row">
                <input type="number" className="step-input" aria-label="Number" placeholder="Number" value={row.step} onChange={(e) => setLabelRow(index, {step: e.target.value})} min={scaleValid ? minNumber : undefined} max={scaleValid ? maxNumber : undefined}/>
                <input type="text" aria-label="Name" placeholder="Name" value={row.name} onChange={(e) => setLabelRow(index, {name: e.target.value})} maxLength={50}/>
                <button type="button" onClick={() => setLabelRows(labelRows.filter((item, position) => position !== index))}>Remove</button>
              </div>
            ))}

            {labelRows.length < 20 && <button type="button" onClick={() => setLabelRows(labelRows.concat([{step: '', name: ''}]))}>Add name</button>}
          </div>
        </>
      )}

      {(fieldType === 'choice' || fieldType === 'multi_choice') && (
        <div className="option-rows">
          <b>Options</b>

          {options.map((option, index) => (
            <div key={option.id || index} className="option-row">
              <input type="text" aria-label={`Option ${index + 1}`} value={option.label} onChange={(e) => setOptionLabel(index, e.target.value)} maxLength={50}/>
              <button type="button" onClick={() => setOptions(options.filter((item, position) => position !== index))}>Remove</button>
            </div>
          ))}

          {options.length < 50 && <button type="button" onClick={() => setOptions(options.concat([{label: ''}]))}>Add option</button>}
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      {pendingClear && (
        <div>
          <p role="alert">{pendingClear} entries use options you removed. They will be cleared from those entries.</p>
          <button type="button" className="danger" onClick={() => submit(true)} disabled={submitting}>Remove and save</button>
        </div>
      )}

      <div className="actions">
        <button type="submit" className="primary" disabled={submitting}>{submitLabel}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
