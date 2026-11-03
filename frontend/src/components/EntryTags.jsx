import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addEntryTagRequest, listEntryTagsRequest, listTagsRequest, removeEntryTagRequest } from '../api/tags';
import TagSwatch from './TagSwatch';

export default function EntryTags({worldId, entryId, canEdit}) {
  const [entryTags, setEntryTags] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [tagId, setTagId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const requests = [listEntryTagsRequest(worldId, entryId)];

    if (canEdit) {
      requests.push(listTagsRequest(worldId));
    }

    Promise.all(requests)
      .then(([entryData, tagData]) => {
        setEntryTags(entryData);
        setAllTags(tagData || []);
      })
      .catch((err) => setError(err.message));
  }, [worldId, entryId, canEdit]);

  const available = entryTags ? allTags.filter((tag) => !entryTags.some((item) => item.id === tag.id)) : [];

  async function handleAdd(event) {
    event.preventDefault();
    setError('');

    try {
      setEntryTags(await addEntryTagRequest(worldId, entryId, tagId));
      setTagId('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(removeId) {
    setError('');

    try {
      setEntryTags(await removeEntryTagRequest(worldId, entryId, removeId));
    } catch (err) {
      setError(err.message);
    }
  }

  if (!entryTags) {
    return <p>{error || 'Loading'}</p>;
  }

  return (
    <div>
      <h2>Tags</h2>

      <div className="tagbox">
        {entryTags.length === 0 && !canEdit && <span className="muted">No tags yet</span>}

        {canEdit && allTags.length === 0 && <span className="muted">No tags exist in this world yet. <Link to={`/worlds/${worldId}/tags`}>Click here to create some</Link></span>}

        {entryTags.map((tag) => (
          <span key={tag.id} className="chip">
            <TagSwatch color={tag.color}/>{tag.name}

            {canEdit && <button type="button" aria-label={`Remove ${tag.name}`} onClick={() => handleRemove(tag.id)}>&times;</button>}
          </span>
        ))}

        {canEdit && available.length > 0 && (
          <form className="inline-form" onSubmit={handleAdd}>
            <select aria-label="Add a tag" value={tagId} onChange={(e) => setTagId(e.target.value)}>
              <option value="">Add a tag</option>
              {available.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>

            <button type="submit" disabled={!tagId}>Add</button>
          </form>
        )}
      </div>

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
