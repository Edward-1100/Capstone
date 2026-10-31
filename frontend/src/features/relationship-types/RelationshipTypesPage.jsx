import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { createRelationshipTypeRequest, deleteRelationshipTypeRequest, listRelationshipTypesRequest, updateRelationshipTypeRequest } from '../../api/relationshipTypes';
import { getWorldRequest } from '../../api/worlds';
import RelationshipTypeForm from '../../components/RelationshipTypeForm';
import { describeSide } from '../../utils/relationships';

const NEW_TYPE = {name: '', description: '', symmetric: false, fromAny: true, fromTypeIds: [], toAny: true, toTypeIds: []};

export default function RelationshipTypesPage() {
  const {id} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [types, setTypes] = useState([]);
  const [entryTypes, setEntryTypes] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingType, setDeletingType] = useState(null);
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getWorldRequest(id), listRelationshipTypesRequest(id), listEntryTypesRequest(id)])
      .then(([worldData, typeData, entryTypeData]) => {
        setWorld(worldData);
        setTypes(typeData);
        setEntryTypes(entryTypeData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  async function reload() {
    const [typeData, entryTypeData] = await Promise.all([listRelationshipTypesRequest(id), listEntryTypesRequest(id)]);

    setTypes(typeData);
    setEntryTypes(entryTypeData);
  }

  async function handleCreate(data) {
    await createRelationshipTypeRequest(id, data);
    setAdding(false);
    await reload();
  }

  async function handleUpdate(typeId, data) {
    await updateRelationshipTypeRequest(id, typeId, data);
    setEditingId(null);
    await reload();
  }

  function startDelete(type) {
    setError('');
    setDeletingType(type);
    setConfirmName('');
  }

  async function handleDelete(event) {
    event.preventDefault();
    setError('');

    try {
      await deleteRelationshipTypeRequest(id, deletingType.id, confirmName);
      setDeletingType(null);
      await reload();
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

      <h1>Relationship types</h1>

      {error && <p role="alert">{error}</p>}

      {types.length === 0 && <p>No relationship types yet</p>}

      <ul>
        {types.map((type) => (
          <li key={type.id}>
            {editingId !== type.id && (
              <div>
                <p>{type.name}{type.symmetric && ' (works both ways)'}, {type.relationshipCount} relationships</p>
                <p>First: {describeSide(type.fromAny, type.fromTypeIds, entryTypes)}. Second: {describeSide(type.toAny, type.toTypeIds, entryTypes)}.</p>
                {type.description && <p>{type.description}</p>}
              </div>
            )}

            {editingId === type.id && <RelationshipTypeForm initial={type} entryTypes={entryTypes} editing submitLabel="Save changes" onSubmit={(data) => handleUpdate(type.id, data)} onCancel={() => setEditingId(null)}/>}

            {canEdit && editingId !== type.id && <button onClick={() => setEditingId(type.id)}>Edit</button>}

            {canEdit && editingId !== type.id && <button onClick={() => startDelete(type)}>Delete</button>}
          </li>
        ))}
      </ul>

      {canEdit && !adding && <button onClick={() => setAdding(true)}>New relationship type</button>}

      {adding && <RelationshipTypeForm initial={NEW_TYPE} entryTypes={entryTypes} submitLabel="Add relationship type" onSubmit={handleCreate} onCancel={() => setAdding(false)}/>}

      {deletingType && (
        <section>
          <h2>Delete {deletingType.name}</h2>

          <p>{deletingType.relationshipCount} relationships use this type. They will be removed.</p>

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
