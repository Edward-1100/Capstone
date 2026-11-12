import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ancestorsRequest, parentOptionsRequest } from '../api/nesting';

export default function EntryPlace({worldId, entry, types, canEdit, editing, onEdit, onCancel, onSave}) {
  const [ancestors, setAncestors] = useState([]);
  const [options, setOptions] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const nestable = types.some((type) => type.id === entry.typeId && type.nestMode !== 'none');
  const open = editing === 'parent';
  const trail = entry.parentId ? (ancestors.length > 0 ? ancestors : [entry.parent]) : [];

  useEffect(() => {
    if (!entry.parentId) {
      return;
    }

    ancestorsRequest(worldId, entry.id)
      .then(setAncestors)
      .catch(() => setAncestors([]));
  }, [worldId, entry.id, entry.parentId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    parentOptionsRequest(worldId, entry.typeId, entry.id)
      .then(setOptions)
      .catch((err) => setError(err.message));
  }, [open, worldId, entry.typeId, entry.id]);

  function handleEdit() {
    setDraft(entry.parentId || '');
    setError('');
    onEdit();
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave(draft || null);
  }

  if (!entry.parentId && entry.children.length === 0 && !(canEdit && nestable)) {
    return null;
  }

  return (
    <div>
      {!open && (entry.parentId || (canEdit && nestable)) && (
        <div className="line">
          <span>
            Inside:{' '}
            {trail.length === 0 && 'nothing'}
            {trail.map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 && ' / '}
                <Link to={`/worlds/${worldId}/entries/${item.id}`}>{item.name}</Link>
              </Fragment>
            ))}
          </span>

          {canEdit && nestable && <button type="button" onClick={handleEdit}>Edit</button>}
        </div>
      )}

      {open && (
        <form className="inline-form" onSubmit={handleSubmit}>
          <select aria-label="Inside" value={draft} onChange={(e) => setDraft(e.target.value)}>
            <option value="">Nothing</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.name} ({option.typeName || 'No type'})</option>)}
          </select>

          <button type="submit">Save</button>
          <button type="button" onClick={onCancel}>Cancel</button>

          {error && <p role="alert">{error}</p>}
        </form>
      )}

      {entry.children.length > 0 && (
        <div>
          <span>Contains:</span>

          <ul className="plain">
            {entry.children.map((child) => <li key={child.id}><Link to={`/worlds/${worldId}/entries/${child.id}`}>{child.name}</Link></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
