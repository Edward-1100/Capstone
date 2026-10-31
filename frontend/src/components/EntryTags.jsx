import { useEffect, useState } from 'react';
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

      {entryTags.length === 0 && <p>No tags yet</p>}

      <ul>
        {entryTags.map((tag) => (
          <li key={tag.id}>
            <TagSwatch color={tag.color}/> {tag.name}

            {canEdit && <button onClick={() => handleRemove(tag.id)}>Remove</button>}
          </li>
        ))}
      </ul>

      {error && <p role="alert">{error}</p>}

      {canEdit && available.length > 0 && (
        <form onSubmit={handleAdd}>
          <label htmlFor="addTag">Add tag</label>

          <select id="addTag" value={tagId} onChange={(e) => setTagId(e.target.value)}>
            <option value="">Choose a tag</option>
            {available.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>

          <button type="submit" disabled={!tagId}>Add</button>
        </form>
      )}
    </div>
  );
}
