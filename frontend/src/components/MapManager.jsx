import { useState } from 'react';
import { createMapRequest, deleteMapRequest, renameMapRequest } from '../api/maps';
import { countLabel } from '../utils/text';

const MAX_SIZE = 100 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function MapRow({worldId, map, current, canEdit, onOpen, onChanged}) {
  const [mode, setMode] = useState('view');
  const [name, setName] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState('');

  function open(next) {
    setError('');
    setName(map.name);
    setConfirmName('');
    setMode(next);
  }

  async function handleRename(event) {
    event.preventDefault();
    setError('');

    try {
      await renameMapRequest(worldId, map.id, name);
      setMode('view');
      await onChanged(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(event) {
    event.preventDefault();
    setError('');

    try {
      await deleteMapRequest(worldId, map.id, confirmName);
      await onChanged(map.id);
    } catch (err) {
      setError(err.message);
    }
  }

  if (mode === 'rename') {
    return (
      <li>
        <form className="inline-form" onSubmit={handleRename}>
          <input type="text" aria-label="Map name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required/>

          <button type="submit">Save</button>
          <button type="button" onClick={() => setMode('view')}>Cancel</button>

          {error && <p role="alert">{error}</p>}
        </form>
      </li>
    );
  }

  if (mode === 'delete') {
    return (
      <li>
        <p>{countLabel(map.markerCount, 'marker is', 'markers are')} on {map.name}. They will be removed with it.</p>

        <form className="inline-form" onSubmit={handleDelete}>
          <input type="text" aria-label="Type the map name to confirm" placeholder={`Type ${map.name} to confirm`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

          <button type="submit" className="danger" disabled={confirmName !== map.name}>Delete map</button>
          <button type="button" onClick={() => setMode('view')}>Cancel</button>

          {error && <p role="alert">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li>
      <span className={current ? 'current-map' : ''}>{map.name}</span>

      <span className="muted">{countLabel(map.markerCount, 'marker', 'markers')}</span>

      <span className="row-actions">
        {!current && <button type="button" onClick={() => onOpen(map.id)}>View</button>}

        {canEdit && <button type="button" onClick={() => open('rename')}>Rename</button>}

        {canEdit && <button type="button" className="danger" onClick={() => open('delete')}>Delete</button>}
      </span>
    </li>
  );
}

export default function MapManager({worldId, list, currentId, canEdit, onOpen, onChanged, onCreated, onClose}) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const full = list.maps.length >= list.maxMaps;

  function handleFile(event) {
    const chosen = event.target.files[0] || null;

    setError('');

    if (chosen && !ALLOWED_TYPES.includes(chosen.type)) {
      setError('Image must be a PNG, JPEG, or WebP image');
      event.target.value = '';
      setFile(null);

      return;
    }

    if (chosen && chosen.size > MAX_SIZE) {
      setError('Image must be 100 MB or smaller');
      event.target.value = '';
      setFile(null);

      return;
    }

    setFile(chosen);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      const created = await createMapRequest(worldId, name, file);

      setName('');
      setFile(null);
      await onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-body">
      <div className="line">
        <h1 className="title">Maps</h1>

        <span className="muted">{list.maps.length} of {list.maxMaps}</span>

        {onClose && <button type="button" onClick={onClose}>Close</button>}
      </div>

      {list.maps.length > 0 && (
        <ul className="worlds">
          {list.maps.map((map) => <MapRow key={map.id} worldId={worldId} map={map} current={map.id === currentId} canEdit={canEdit} onOpen={onOpen} onChanged={onChanged}/>)}
        </ul>
      )}

      {canEdit && !full && (
        <form className="inline-form" onSubmit={handleCreate}>
          <input type="text" aria-label="New map name" placeholder="Map name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required/>

          <input type="file" aria-label="Map image" accept="image/png,image/jpeg,image/webp" onChange={handleFile} required/>

          <button type="submit" disabled={saving || !file}>Add map</button>
        </form>
      )}

      {canEdit && full && <p className="muted">This world has reached its limit of {list.maxMaps} maps</p>}

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
