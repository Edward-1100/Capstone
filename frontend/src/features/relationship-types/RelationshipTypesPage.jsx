import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { createRelationshipTypeRequest, listRelationshipTypesRequest } from '../../api/relationshipTypes';
import { getWorldRequest } from '../../api/worlds';
import ItemGrid from '../../components/ItemGrid';
import Page from '../../components/Page';
import RelationshipTypeCell from '../../components/RelationshipTypeCell';
import RelationshipTypeForm from '../../components/RelationshipTypeForm';

const NEW_TYPE = {name: '', description: '', fromAny: true, fromTypeIds: [], toAny: true, toTypeIds: []};

export default function RelationshipTypesPage() {
  const {id} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [types, setTypes] = useState([]);
  const [entryTypes, setEntryTypes] = useState([]);
  const [adding, setAdding] = useState(false);

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

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';

  const addForm = <RelationshipTypeForm initial={NEW_TYPE} entryTypes={entryTypes} submitLabel="Add relationship type" onSubmit={handleCreate} onCancel={() => setAdding(false)}/>;

  return (
    <Page crumbs={[{to: `/worlds/${id}`, label: world.name}, {label: 'Relationship types'}]}>
      <ItemGrid storageKey="view-relationship-types" canEdit={canEdit} newLabel="New relationship type" adding={adding} onNew={() => setAdding(true)} addForm={addForm} empty={types.length === 0} emptyText="No relationship types yet">
        {types.map((type) => <RelationshipTypeCell key={type.id} worldId={id} type={type} entryTypes={entryTypes} canEdit={canEdit} onChanged={reload}/>)}
      </ItemGrid>
    </Page>
  );
}
