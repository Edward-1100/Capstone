import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Typeahead from './Typeahead';
import { ancestorsRequest, parentOptionsRequest } from '../api/nesting';

export default function EntryPlace({worldId, entry, types, canEdit, onSave}) {
  const [ancestors, setAncestors] = useState([]);
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const nestable = types.some((type) => type.id === entry.typeId && type.nestMode !== 'none');
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

    setError('');
    parentOptionsRequest(worldId, entry.typeId, entry.id)
      .then(setOptions)
      .catch((err) => setError(err.message));
  }, [open, worldId, entry.typeId, entry.id]);

  function handlePick(parentId) {
    setOpen(false);
    onSave(parentId || null);
  }

  if (!entry.parentId && entry.children.length === 0 && !(canEdit && nestable)) {
    return null;
  }

  return (
    <div className="entry-place">
      {(nestable || trail.length > 0) && (
        <div className="place-row">
          <span className="muted">Inside</span>

          {trail.length === 0 && <span className="muted">Nothing</span>}

          {trail.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && <span className="muted">/</span>}
              <Link to={`/worlds/${worldId}/entries/${item.id}`}>{item.name}</Link>
            </Fragment>
          ))}

          {canEdit && nestable && !open && <button type="button" onClick={() => setOpen(true)}>{entry.parentId ? 'Move' : 'Set'}</button>}
          {canEdit && nestable && !open && entry.parentId && <button type="button" onClick={() => handlePick('')}>Remove</button>}
        </div>
      )}

      {open && (
        <div className="place-pick">
          <Typeahead options={options.map((option) => ({id: option.id, label: `${option.name} (${option.typeName || 'No type'})`}))} onPick={handlePick} placeholder="Search for the entry it is inside" label="Inside" showCount={false}/>

          <button type="button" onClick={() => setOpen(false)}>Cancel</button>

          {error && <p role="alert">{error}</p>}
        </div>
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
