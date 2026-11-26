import { useState } from 'react';
import { deleteTagRequest, updateTagRequest } from '../api/tags';
import { countLabel } from '../utils/text';
import TagForm from './TagForm';
import TagRules from './TagRules';
import TagSwatch from './TagSwatch';

export default function TagCell({worldId, badges, tag, canEdit, focus, focusEntryId, onChanged}) {
  const [mode, setMode] = useState(focus ? 'open' : 'view');
  const [tab, setTab] = useState(focus ? 'rule' : 'details');
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

  function open(next) {
    setTab(next);
    setMode('open');
  }

  if (mode === 'open') {
    return (
      <li className="cell open">
        <div className="card-head">
          <h2><TagSwatch color={tag.color}/>{tag.name}</h2>

          <div className="head-actions"><button type="button" onClick={close}>Close</button></div>
        </div>

        <div className="panel-tabs" role="tablist">
          {canEdit && <button type="button" role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>Details</button>}
          <button type="button" role="tab" aria-selected={tab === 'rule'} className={tab === 'rule' ? 'on' : ''} onClick={() => setTab('rule')}>Rule</button>
          {canEdit && <button type="button" role="tab" aria-selected={tab === 'delete'} className={tab === 'delete' ? 'on danger' : 'danger'} onClick={() => setTab('delete')}>Delete</button>}
        </div>

        {tab === 'details' && canEdit && <TagForm initial={tag} submitLabel="Save" onSubmit={handleUpdate} onCancel={close}/>}

        {tab === 'rule' && <TagRules worldId={worldId} tag={tag} canEdit={canEdit} focusEntryId={focusEntryId} onChanged={onChanged}/>}

        {tab === 'delete' && canEdit && (
          <div>
            <p>{countLabel(tag.entryCount, 'entry has', 'entries have')} the tag {tag.name}. It will be removed from them.</p>

            <form className="inline-form" onSubmit={handleDelete}>
              <input type="text" aria-label="Type the tag name to confirm" placeholder={`Type ${tag.name} to confirm`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

              <button type="submit" className="danger" disabled={confirmName !== tag.name}>Delete tag</button>

              {error && <p role="alert">{error}</p>}
            </form>
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="cell">
      <div className="cell-name"><TagSwatch color={tag.color}/>{tag.name}</div>

      <div className="cell-col" data-label="Rule">
        <span className="badge-scroll">
          {!tag.hasRule && <span className="mini">Manual</span>}
          {tag.hasRule && tag.paused && <span className="mini">Paused</span>}
          {tag.hasRule && !badges && <span className="muted">Loading</span>}
          {tag.hasRule && badges && badges.length === 0 && <span className="mini">Manual</span>}
          {tag.hasRule && badges && badges.map((text, index) => <span key={index} className="mini on">{text}</span>)}
        </span>
      </div>

      <div className="cell-col" data-label="Entries">{tag.entryCount}</div>

      <div className="cell-actions">
        <button type="button" onClick={() => open(canEdit ? 'details' : 'rule')}>{canEdit ? 'Edit' : 'View rule'}</button>
      </div>
    </li>
  );
}
