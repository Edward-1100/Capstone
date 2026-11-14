import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listEntriesRequest } from '../api/entries';
import { createRelationshipRequest, deleteRelationshipRequest, listEntryRelationshipsRequest } from '../api/relationships';
import { listRelationshipTypesRequest } from '../api/relationshipTypes';
import { allows } from '../utils/relationships';

export default function EntryRelationships({worldId, entryId, entryName, entryTypeId, canEdit}) {
  const [relationships, setRelationships] = useState(null);
  const [types, setTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [adding, setAdding] = useState(false);
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

  function closeForm() {
    setAdding(false);
    setTypeId('');
    setOtherId('');
    setError('');
  }

  async function reload() {
    setRelationships(await listEntryRelationshipsRequest(worldId, entryId));
  }

  async function handleAdd(event) {
    event.preventDefault();
    setError('');

    const reversed = direction === 'in';

    try {
      await createRelationshipRequest(worldId, {typeId, fromEntryId: reversed ? otherId : entryId, toEntryId: reversed ? entryId : otherId});
      closeForm();
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

  const reversed = direction === 'in';

  const selfCell = <strong className="self">{entryName}</strong>;

  const typeSelect = (
    <select aria-label="Relationship type" value={typeId} onChange={(e) => handleTypeChange(e.target.value)}>
      <option value="">Choose a type</option>
      {types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  );

  const otherSelect = (
    <select aria-label="Other entry" value={otherId} disabled={!type} onChange={(e) => setOtherId(e.target.value)}>
      <option value="">Choose an entry</option>
      {candidates.map((other) => <option key={other.id} value={other.id}>{other.name} ({other.typeName || 'no type'})</option>)}
    </select>
  );

  return (
    <div>
      <div className="line">
        <h2>Relationships</h2>

        {canEdit && !adding && <button type="button" onClick={() => setAdding(true)}>Add relationship</button>}
      </div>

      {relationships.length === 0 && <p className="muted">No relationships yet</p>}

      {relationships.length > 0 && (
        <ul className="links">
          <li className="links-head">
            <span>From</span>
            <span>Relationship</span>
            <span>To</span>
          </li>

          {relationships.map((item) => {
            const outgoing = item.direction === 'out';
            const other = <span className="other-entry"><Link to={`/worlds/${worldId}/entries/${item.otherId}`}>{item.otherName}</Link><span className="muted">{item.otherTypeName || 'no type'}</span></span>;

            return (
              <li key={item.id}>
                {outgoing ? selfCell : other}

                <span className="link-kind">{item.typeName}</span>

                {outgoing ? other : selfCell}

                {canEdit && <span className="row-actions"><button type="button" onClick={() => handleRemove(item.id)}>Remove</button></span>}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p role="alert">{error}</p>}

      {adding && (
        <form className="add-form" onSubmit={handleAdd}>
          <ul className="links">
            <li className="links-head">
              <span>From</span>
              <span>Relationship</span>
              <span>To</span>
            </li>

            <li>
              <div className="cell"><span className="cap">From</span>{reversed ? otherSelect : selfCell}</div>

              <div className="cell"><span className="cap">Relationship</span>{typeSelect}</div>

              <div className="cell"><span className="cap">To</span>{reversed ? selfCell : otherSelect}</div>
            </li>
          </ul>

          {type && candidates.length === 0 && <p className="muted">No entries can be connected this way</p>}

          <div className="actions">
            <button type="submit" disabled={!type || !otherId}>Add relationship</button>
            <button type="button" onClick={() => handleDirectionChange(reversed ? 'out' : 'in')}>Swap sides</button>
            <button type="button" onClick={closeForm}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
