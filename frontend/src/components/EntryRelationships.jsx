import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listEntriesRequest } from '../api/entries';
import { createRelationshipRequest, deleteRelationshipRequest, listEntryRelationshipsRequest } from '../api/relationships';
import { listRelationshipTypesRequest } from '../api/relationshipTypes';
import { allows } from '../utils/relationships';

export default function EntryRelationships({worldId, entryId, entryTypeId, canEdit}) {
  const [relationships, setRelationships] = useState(null);
  const [types, setTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [typeId, setTypeId] = useState('');
  const [direction, setDirection] = useState('out');
  const [otherId, setOtherId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const requests = [listEntryRelationshipsRequest(worldId, entryId)];

    if (canEdit) {
      requests.push(listRelationshipTypesRequest(worldId), listEntriesRequest(worldId));
    }

    Promise.all(requests)
      .then(([relationshipData, typeData, entryData]) => {
        setRelationships(relationshipData);
        setTypes(typeData || []);
        setEntries(entryData || []);
      })
      .catch((err) => setError(err.message));
  }, [worldId, entryId, canEdit]);

  const type = types.find((item) => item.id === typeId);

  function fits(firstTypeId, secondTypeId) {
    return allows(type.fromAny, type.fromTypeIds, firstTypeId) && allows(type.toAny, type.toTypeIds, secondTypeId);
  }

  function otherFits(other) {
    if (type.symmetric) {
      return fits(entryTypeId, other.typeId) || fits(other.typeId, entryTypeId);
    }

    return direction === 'out' ? fits(entryTypeId, other.typeId) : fits(other.typeId, entryTypeId);
  }

  const candidates = type ? entries.filter((other) => other.id !== entryId && otherFits(other)) : [];

  function handleTypeChange(value) {
    setTypeId(value);
    setOtherId('');
  }

  function handleDirectionChange(value) {
    setDirection(value);
    setOtherId('');
  }

  async function reload() {
    setRelationships(await listEntryRelationshipsRequest(worldId, entryId));
  }

  async function handleAdd(event) {
    event.preventDefault();
    setError('');

    const reversed = direction === 'in' && !type.symmetric;

    try {
      await createRelationshipRequest(worldId, {typeId, fromEntryId: reversed ? otherId : entryId, toEntryId: reversed ? entryId : otherId});
      setOtherId('');
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(relationshipId) {
    setError('');

    try {
      await deleteRelationshipRequest(worldId, relationshipId);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!relationships) {
    return <p>{error || 'Loading'}</p>;
  }

  return (
    <div>
      <h2>Relationships</h2>

      {relationships.length === 0 && <p>No relationships yet</p>}

      <ul>
        {relationships.map((item) => (
          <li key={item.id}>
            {item.direction === 'out' || item.symmetric ? item.typeName : `${item.typeName} (incoming)`}: <Link to={`/worlds/${worldId}/entries/${item.otherId}`}>{item.otherName}</Link> ({item.otherTypeName || 'no type'})

            {canEdit && <button onClick={() => handleRemove(item.id)}>Remove</button>}
          </li>
        ))}
      </ul>

      {error && <p role="alert">{error}</p>}

      {canEdit && (
        <form onSubmit={handleAdd}>
          <div>
            <label htmlFor="relType">Relationship type</label>

            <select id="relType" value={typeId} onChange={(e) => handleTypeChange(e.target.value)}>
              <option value="">Choose a type</option>
              {types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          {type && !type.symmetric && (
            <div>
              <label htmlFor="relDirection">Direction</label>

              <select id="relDirection" value={direction} onChange={(e) => handleDirectionChange(e.target.value)}>
                <option value="out">From this entry</option>
                <option value="in">To this entry</option>
              </select>
            </div>
          )}

          {type && (
            <div>
              <label htmlFor="relOther">Other entry</label>

              <select id="relOther" value={otherId} onChange={(e) => setOtherId(e.target.value)}>
                <option value="">Choose an entry</option>
                {candidates.map((other) => <option key={other.id} value={other.id}>{other.name} ({other.typeName || 'no type'})</option>)}
              </select>
            </div>
          )}

          {type && candidates.length === 0 && <p>No entries can be connected this way</p>}

          <button type="submit" disabled={!type || !otherId}>Add relationship</button>
        </form>
      )}
    </div>
  );
}
