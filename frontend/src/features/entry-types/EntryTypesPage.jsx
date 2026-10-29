import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createEntryTypeRequest, deleteEntryTypeRequest, listEntryTypesRequest, updateEntryTypeRequest } from '../../api/entryTypes';
import { getWorldRequest } from '../../api/worlds';
import TypeFields from '../../components/TypeFields';

export default function EntryTypesPage() {
  const {id} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [types, setTypes] = useState([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deletingType, setDeletingType] = useState(null);
  const [confirmName, setConfirmName] = useState('');
  const [moveToTypeId, setMoveToTypeId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getWorldRequest(id), listEntryTypesRequest(id)])
      .then(([worldData, typeData]) => {
        setWorld(worldData);
        setTypes(typeData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  async function reloadTypes() {
    setTypes(await listEntryTypesRequest(id));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError('');

    try {
      await createEntryTypeRequest(id, newName);
      setNewName('');
      await reloadTypes();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(type) {
    setError('');
    setEditingId(type.id);
    setEditName(type.name);
  }

  async function handleRename(event, typeId) {
    event.preventDefault();
    setError('');

    try {
      await updateEntryTypeRequest(id, typeId, editName);
      setEditingId(null);
      await reloadTypes();
    } catch (err) {
      setError(err.message);
    }
  }

  function startDelete(type) {
    setError('');
    setDeletingType(type);
    setConfirmName('');
    setMoveToTypeId('');
  }

  async function handleDelete(event) {
    event.preventDefault();
    setError('');

    try {
      await deleteEntryTypeRequest(id, deletingType.id, confirmName, moveToTypeId || undefined);
      setDeletingType(null);
      await reloadTypes();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!world) {
    return <p>Loading</p>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';

  return (
    <div>
      <p><Link to={`/worlds/${id}`}>Back to {world.name}</Link></p>

      <h1>Entry types</h1>

      {error && <p role="alert">{error}</p>}

      <ul>
        {types.map((type) => (
          <li key={type.id}>
            {editingId !== type.id && <span>{type.name} ({type.entryCount} entries)</span>}

            {editingId === type.id && (
              <form onSubmit={(e) => handleRename(e, type.id)}>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} required/>
                <button type="submit">Save</button>
                <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
              </form>
            )}

            {canEdit && editingId !== type.id && <button onClick={() => startEdit(type)}>Edit</button>}

            {canEdit && editingId !== type.id && <button onClick={() => startDelete(type)}>Delete</button>}

            <TypeFields worldId={id} type={type} canEdit={canEdit} onChanged={reloadTypes}/>
          </li>
        ))}
      </ul>

      {canEdit && (
        <form onSubmit={handleCreate}>
          <label htmlFor="newName">New type</label>
          <input id="newName" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50} required/>

          <button type="submit">Add type</button>
        </form>
      )}

      {deletingType && (
        <section>
          <h2>Delete {deletingType.name}</h2>

          <p>{deletingType.entryCount} entries use this type.</p>

          {deletingType.entryCount > 0 && (
            <div>
              <label htmlFor="moveTo">What should happen to those entries?</label>

              <select id="moveTo" value={moveToTypeId} onChange={(e) => setMoveToTypeId(e.target.value)}>
                <option value="">Leave them without a type</option>
                {types.filter((type) => type.id !== deletingType.id).map((type) => <option key={type.id} value={type.id}>Move to {type.name}</option>)}
              </select>
            </div>
          )}

          <form onSubmit={handleDelete}>
            <p>Type the type's name ({deletingType.name}) to confirm.</p>

            <input type="text" value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

            <button type="submit" disabled={confirmName !== deletingType.name}>Delete type</button>
            <button type="button" onClick={() => setDeletingType(null)}>Cancel</button>
          </form>
        </section>
      )}
    </div>
  );
}
