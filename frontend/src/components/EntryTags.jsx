import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addEntryTagRequest, listEntryTagsRequest, listTagsRequest, removeEntryTagRequest } from '../api/tags';
import TagSwatch from './TagSwatch';
import Typeahead from './Typeahead';

export default function EntryTags({worldId, entryId, canEdit}) {
  const [entryTags, setEntryTags] = useState(null);
  const [allTags, setAllTags] = useState([]);
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

  const available = entryTags ? allTags.filter((tag) => !entryTags.some((item) => item.id === tag.id && !item.auto)) : [];

  async function handleAdd(tagId) {
    setError('');

    try {
      setEntryTags(await addEntryTagRequest(worldId, entryId, tagId));
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

            {tag.auto && <Link className="auto" to={`/worlds/${worldId}/tags?tag=${tag.id}&entry=${entryId}`}>auto</Link>}

            {canEdit && !tag.auto && <button type="button" aria-label={`Remove ${tag.name}`} onClick={() => handleRemove(tag.id)}>&times;</button>}
          </span>
        ))}

        {canEdit && available.length > 0 && (
          <Typeahead options={available.map((tag) => ({id: tag.id, label: tag.name, count: tag.entryCount}))} onPick={handleAdd} placeholder="Add a tag" label="Add a tag"/>
        )}
      </div>

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
