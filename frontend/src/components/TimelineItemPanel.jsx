import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteTimelineEntryRequest, setTimelineColorRequest, updateTimelineEntryRequest } from '../api/timeline';
import { dateValuesOf, formatSpan } from '../utils/timeline';
import TimelineDateForm from './TimelineDateForm';

export default function TimelineItemPanel({worldId, item, canEdit, onChanged, onRemoved, onClose}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(payload) {
    await updateTimelineEntryRequest(worldId, item.id, payload);
    setEditing(false);
    await onChanged();
  }

  async function handleColor(color) {
    setError('');

    try {
      await setTimelineColorRequest(worldId, item.id, color);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove() {
    setError('');

    try {
      await deleteTimelineEntryRequest(worldId, item.id);
      await onRemoved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="drawer-body">
      <div className="line">
        <h1 className="title">{item.entryName}</h1>

        <button type="button" onClick={onClose}>Close</button>
      </div>

      <p className="muted">{item.typeName}</p>

      <p>{formatSpan(item)}</p>

      {canEdit && !editing && (
        <div className="swatches" role="group" aria-label="Color">
          <button type="button" className={item.color ? 'swatch-pick none' : 'swatch-pick none selected'} aria-label="Default color" aria-pressed={!item.color} onClick={() => handleColor(null)}>x</button>

          <input type="color" aria-label="Custom color" value={item.color || '#1a73e8'} onChange={(e) => handleColor(e.target.value)}/>
        </div>
      )}

      {canEdit && !editing && (
        <div className="actions">
          <button type="button" onClick={() => setEditing(true)}>Change dates</button>
          <button type="button" className="danger" onClick={handleRemove}>Remove from timeline</button>
        </div>
      )}

      {editing && <TimelineDateForm initialValues={dateValuesOf(item)} submitLabel="Save" onSubmit={handleSave} onCancel={() => setEditing(false)}/>}

      <p><Link to={`/worlds/${worldId}/entries/${item.entryId}`}>Open the entry</Link></p>

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
