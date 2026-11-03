import { useState } from 'react';

export default function TagForm({initial, submitLabel, onSubmit, onCancel}) {
  const [name, setName] = useState(initial.name);
  const [useColor, setUseColor] = useState(Boolean(initial.color));
  const [color, setColor] = useState(initial.color || '#808080');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      await onSubmit({name, color: useColor ? color : null});
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <input type="text" aria-label="Tag name" placeholder="Tag name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required/>

      <label className="check"><input type="checkbox" checked={useColor} onChange={(e) => setUseColor(e.target.checked)}/> Color</label>

      {useColor && <input type="color" aria-label="Tag color" value={color} onChange={(e) => setColor(e.target.value)}/>}

      <button type="submit">{submitLabel}</button>
      <button type="button" onClick={onCancel}>Cancel</button>

      {error && <p role="alert">{error}</p>}
    </form>
  );
}
