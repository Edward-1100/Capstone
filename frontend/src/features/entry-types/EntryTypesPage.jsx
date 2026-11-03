import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createEntryTypeRequest, listEntryTypesRequest } from '../../api/entryTypes';
import { getWorldRequest } from '../../api/worlds';
import EntryTypeCell from '../../components/EntryTypeCell';
import ItemGrid from '../../components/ItemGrid';
import Page from '../../components/Page';

export default function EntryTypesPage() {
  const {id} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [types, setTypes] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getWorldRequest(id), listEntryTypesRequest(id)])
      .then(([worldData, typeData]) => {
        setWorld(worldData);
        setTypes(typeData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  async function reload() {
    setTypes(await listEntryTypesRequest(id));
  }

  function closeAdd() {
    setAdding(false);
    setNewName('');
    setError('');
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError('');

    try {
      await createEntryTypeRequest(id, newName);
      closeAdd();
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';

  const addForm = (
    <form className="inline-form" onSubmit={handleCreate}>
      <input type="text" aria-label="New type name" placeholder="Type name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50} required/>

      <button type="submit">Add type</button>
      <button type="button" onClick={closeAdd}>Cancel</button>

      {error && <p role="alert">{error}</p>}
    </form>
  );

  return (
    <Page crumbs={[{to: `/worlds/${id}`, label: world.name}, {label: 'Entry types'}]}>
      <ItemGrid storageKey="view-entry-types" canEdit={canEdit} newLabel="New type" adding={adding} onNew={() => setAdding(true)} addForm={addForm} empty={types.length === 0} emptyText="No entry types yet">
        {types.map((type) => <EntryTypeCell key={type.id} worldId={id} type={type} types={types} canEdit={canEdit} onChanged={reload}/>)}
      </ItemGrid>
    </Page>
  );
}
