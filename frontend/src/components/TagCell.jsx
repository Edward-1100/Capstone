import { useState } from 'react';
import { deleteTagRequest, updateTagRequest } from '../api/tags';
import { countLabel } from '../utils/text';
import TagForm from './TagForm';
import TagRules from './TagRules';
import TagSwatch from './TagSwatch';

export default function TagCell({worldId, tag, canEdit, focus, focusEntryId, onChanged}) {
  const [mode, setMode] = useState(focus ? 'rules' : 'view');
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState('');

  function close() {
    setMode('view');
    setConfirmName('');
    setError('');
  }

  async function handleUpdate(data) {
    await updateTagRequest(worldId, tag.id, data);
    close();
    await onChanged();
  }

  async function handleDelete(event) {
    event.preventDefault();
    setError('');

    try {
      await deleteTagRequest(worldId, tag.id, confirmName);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  if (mode === 'edit') {
    return (
      <li className="cell open">
        <TagForm initial={tag} submitLabel="Save" onSubmit={handleUpdate} onCancel={close}/>
      </li>
    );
  }

  if (mode === 'rules') {
    return (
      <li className="cell open">
        <div className="line">
          <h3><TagSwatch color={tag.color}/>{tag.name}</h3>

          <button type="button" onClick={close}>Close</button>
        </div>

        <TagRules worldId={worldId} tag={tag} canEdit={canEdit} focusEntryId={focusEntryId} onChanged={onChanged}/>
      </li>
    );
  }

  if (mode === 'delete') {
    return (
      <li className="cell open">
        <p>{countLabel(tag.entryCount, 'entry has', 'entries have')} the tag {tag.name}. It will be removed from them.</p>

        <form className="inline-form" onSubmit={handleDelete}>
          <input type="text" aria-label="Type the tag name to confirm" placeholder={`Type ${tag.name} to confirm`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

          <button type="submit" className="danger" disabled={confirmName !== tag.name}>Delete tag</button>
          <button type="button" onClick={close}>Cancel</button>

          {error && <p role="alert">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="cell">
      <div className="cell-name"><TagSwatch color={tag.color}/>{tag.name}</div>

      <div className="cell-info">{countLabel(tag.entryCount, 'entry', 'entries')}{tag.hasRule ? (tag.paused ? ', rule paused' : ', has a rule') : ''}</div>

      <div className="cell-actions">
        <button type="button" onClick={() => setMode('rules')}>{canEdit ? 'Rule' : 'View rule'}</button>

        {canEdit && <button type="button" onClick={() => setMode('edit')}>Edit</button>}
        {canEdit && <button type="button" className="danger" onClick={() => setMode('delete')}>Delete</button>}
      </div>
    </li>
  );
}
