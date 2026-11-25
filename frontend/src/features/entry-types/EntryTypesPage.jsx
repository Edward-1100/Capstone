import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setEntryTypeMappableRequest } from '../../api/maps';
import { setEntryTypeNestingRequest } from '../../api/nesting';
import { setEntryTypeTimelineableRequest } from '../../api/timeline';
import { createEntryTypeRequest, listEntryTypesRequest } from '../../api/entryTypes';
import { getWorldRequest } from '../../api/worlds';
import EntryTypeCell from '../../components/EntryTypeCell';
import EntryTypeForm from '../../components/EntryTypeForm';
import ItemGrid from '../../components/ItemGrid';
import Page from '../../components/Page';

export default function EntryTypesPage() {
  const {id} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [types, setTypes] = useState([]);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

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

  async function handleCreate(data) {
    const created = await createEntryTypeRequest(id, data.name);

    if (data.mappable) {
      await setEntryTypeMappableRequest(id, created.id, true);
    }

    if (data.timelineable) {
      await setEntryTypeTimelineableRequest(id, created.id, true);
    }

    if (data.nestMode !== 'none') {
      await setEntryTypeNestingRequest(id, created.id, data.nestMode === 'chosen' ? {mode: data.nestMode, parentTypeIds: data.parentTypeIds} : {mode: data.nestMode});
    }

    setAdding(false);
    await reload();
  }

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';

  const addForm = <EntryTypeForm types={types} onSubmit={handleCreate} onCancel={() => setAdding(false)}/>;
  const shown = types.filter((type) => type.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Page size="medium" crumbs={[{to: `/worlds/${id}`, label: world.name}, {label: 'Entry types'}]}>
      <ItemGrid title="Entry types" nameLabel="Name" columns={[{label: 'Entries', width: '4.5rem'}, {label: 'Fields', width: 'minmax(0, 3fr)'}, {label: 'Placed on', width: '10rem'}]} query={query} onQuery={setQuery} searchLabel="Search entry types" storageKey="view-entry-types" canEdit={canEdit} newLabel="New type" adding={adding} onNew={() => setAdding(true)} addForm={addForm} empty={shown.length === 0} emptyText="No entry types yet">
        {shown.map((type) => <EntryTypeCell key={type.id} worldId={id} type={type} types={types} canEdit={canEdit} onChanged={reload}/>)}
      </ItemGrid>
    </Page>
  );
}
