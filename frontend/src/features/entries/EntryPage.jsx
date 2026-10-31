import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addEntryImageRequest, deleteEntryImageRequest, deleteEntryRequest, getEntryRequest, replaceEntryImageRequest } from '../../api/entries';
import { getWorldRequest } from '../../api/worlds';
import EntryRelationships from '../../components/EntryRelationships';
import EntryTags from '../../components/EntryTags';
import { formatValue } from '../../utils/fields';

const MAX_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function checkFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Image must be a PNG, JPEG, or WebP image';
  }

  if (file.size > MAX_SIZE) {
    return 'Image must be 5 MB or smaller';
  }

  return '';
}

export default function EntryPage() {
  const {id, entryId} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [entry, setEntry] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getWorldRequest(id), getEntryRequest(id, entryId)])
      .then(([worldData, entryData]) => {
        setWorld(worldData);
        setEntry(entryData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : `/worlds/${id}/entries`, {replace: true}));
  }, [id, entryId, navigate]);

  async function handleAdd(event) {
    const file = event.target.files[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    const problem = checkFile(file);

    if (problem) {
      setError(problem);

      return;
    }

    setError('');

    try {
      setEntry(await addEntryImageRequest(id, entryId, file));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReplace(event, imageId) {
    const file = event.target.files[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    const problem = checkFile(file);

    if (problem) {
      setError(problem);

      return;
    }

    setError('');

    try {
      setEntry(await replaceEntryImageRequest(id, entryId, imageId, file));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveImage(imageId) {
    setError('');

    try {
      setEntry(await deleteEntryImageRequest(id, entryId, imageId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    setError('');

    try {
      await deleteEntryRequest(id, entryId);
      navigate(`/worlds/${id}/entries`, {replace: true});
    } catch (err) {
      setError(err.message);
    }
  }

  if (!world || !entry) {
    return <p>Loading</p>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';

  return (
    <div>
      <p><Link to={`/worlds/${id}/entries`}>Back to entries</Link></p>

      <h1>{entry.name}</h1>

      <p>Type: {entry.typeName || 'none'}</p>

      <p>{entry.description}</p>

      {entry.typeFields.length > 0 && <h2>Details</h2>}

      {entry.typeFields.map((definition) => <p key={definition.id}>{definition.name}: {formatValue(definition, entry.fields[definition.id]) || 'not set'}</p>)}

      <EntryTags worldId={id} entryId={entryId} canEdit={canEdit}/>
      
      <EntryRelationships worldId={id} entryId={entryId} entryTypeId={entry.typeId} canEdit={canEdit}/>

      {error && <p role="alert">{error}</p>}

      <h2>Images</h2>

      {entry.images.length === 0 && <p>No images yet</p>}

      <ul>
        {entry.images.map((image) => (
          <li key={image.id}>
            <img src={image.url} alt={entry.name} width="200"/>

            {canEdit && (
              <div>
                <label>Replace <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleReplace(e, image.id)}/></label>
                <button onClick={() => handleRemoveImage(image.id)}>Remove</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && entry.images.length < MAX_IMAGES && (
        <div>
          <label htmlFor="addImage">Add image (PNG, JPEG, or WebP, up to 5 MB)</label>
          <input id="addImage" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAdd}/>
        </div>
      )}

      {canEdit && <p><Link to={`/worlds/${id}/entries/${entryId}/edit`}>Edit entry</Link></p>}

      {canEdit && !confirmingDelete && <button onClick={() => setConfirmingDelete(true)}>Delete entry</button>}

      {canEdit && confirmingDelete && (
        <div>
          <p>Delete this entry?</p>
          <button onClick={handleDelete}>Yes, delete</button>
          <button onClick={() => setConfirmingDelete(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
