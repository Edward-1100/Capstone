import { useState } from 'react';
import { FIELD_TYPE_LABELS, scaleSteps } from '../utils/fields';

export default function FieldForm({initial, editing, submitLabel, onSubmit, onCancel}) {
  const config = initial.config || {};

  const [name, setName] = useState(initial.name);
  const [fieldType, setFieldType] = useState(initial.fieldType);
  const [required, setRequired] = useState(initial.required);
  const [trueLabel, setTrueLabel] = useState(config.trueLabel || 'Yes');
  const [falseLabel, setFalseLabel] = useState(config.falseLabel || 'No');
  const [min, setMin] = useState(config.min === undefined ? '1' : String(config.min));
  const [max, setMax] = useState(config.max === undefined ? '10' : String(config.max));
  const [labels, setLabels] = useState(config.labels || {});
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

  function buildConfig() {
    if (fieldType === 'boolean') {
      return {trueLabel, falseLabel};
    }

    if (fieldType === 'scale') {
      return {min: minNumber, max: maxNumber, labels};
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
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="fieldName">Field name</label>
        <input id="fieldName" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required/>
      </div>

      <div>
        <label htmlFor="fieldType">Field type</label>

        <select id="fieldType" value={fieldType} onChange={(e) => setFieldType(e.target.value)} disabled={editing}>
          {Object.keys(FIELD_TYPE_LABELS).map((key) => <option key={key} value={key}>{FIELD_TYPE_LABELS[key]}</option>)}
        </select>

        {editing && <span>The type can not be changed</span>}
      </div>

      <div>
        <label htmlFor="fieldRequired">Required</label>
        <input id="fieldRequired" type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)}/>
      </div>

      {fieldType === 'boolean' && (
        <div>
          <label htmlFor="trueLabel">Name for yes</label>
          <input id="trueLabel" type="text" value={trueLabel} onChange={(e) => setTrueLabel(e.target.value)} maxLength={50} required/>

          <label htmlFor="falseLabel">Name for no</label>
          <input id="falseLabel" type="text" value={falseLabel} onChange={(e) => setFalseLabel(e.target.value)} maxLength={50} required/>
        </div>
      )}

      {fieldType === 'scale' && (
        <div>
          <label htmlFor="scaleMin">Lowest number</label>
          <input id="scaleMin" type="number" value={min} onChange={(e) => setMin(e.target.value)} required/>

          <label htmlFor="scaleMax">Highest number</label>
          <input id="scaleMax" type="number" value={max} onChange={(e) => setMax(e.target.value)} required/>

          {steps.map((step) => (
            <div key={step}>
              <label htmlFor={`step-${step}`}>Name for {step}</label>
              <input id={`step-${step}`} type="text" value={labels[String(step)] || ''} onChange={(e) => setLabels(Object.assign({}, labels, {[String(step)]: e.target.value}))} maxLength={50}/>
            </div>
          ))}
        </div>
      )}

      {(fieldType === 'choice' || fieldType === 'multi_choice') && (
        <div>
          <p>Options</p>

          {options.map((option, index) => (
            <div key={option.id || index}>
              <input type="text" value={option.label} onChange={(e) => setOptionLabel(index, e.target.value)} maxLength={50}/>
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
          <button type="button" onClick={() => submit(true)} disabled={submitting}>Remove and save</button>
        </div>
      )}

      <button type="submit" disabled={submitting}>{submitLabel}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}
