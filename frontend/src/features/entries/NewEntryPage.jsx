import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createEntryRequest } from '../../api/entries';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { addEntryTagRequest, listTagsRequest } from '../../api/tags';
import { getWorldRequest } from '../../api/worlds';
import EntryForm from '../../components/EntryForm';
import Page from '../../components/Page';

export default function NewEntryPage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [world, setWorld] = useState(null);
  const [types, setTypes] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    Promise.all([getWorldRequest(id), listEntryTypesRequest(id), listTagsRequest(id)])
      .then(([worldData, typeData, tagData]) => {
        if (worldData.role === 'viewer') {
          navigate(`/worlds/${id}/entries`, {replace: true});

          return;
        }

        setWorld(worldData);
        setTypes(typeData);
        setTags(tagData);
      })
      .catch(() => navigate('/', {replace: true}));
  }, [id, navigate]);

  async function reloadTypes() {
    setTypes(await listEntryTypesRequest(id));
  }

  async function handleCreate(data, tagIds) {
    const entry = await createEntryRequest(id, data);

    for (const tagId of tagIds) {
      await addEntryTagRequest(id, entry.id, tagId);
    }

    navigate(`/worlds/${id}/entries/${entry.id}`);
  }

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  return (
    <Page size="wide" crumbs={[{to: `/worlds/${id}`, label: world.name}, {to: `/worlds/${id}/entries`, label: 'Entries'}, {label: 'New entry'}]}>
      <h1 className="title page-title">New entry</h1>

      <EntryForm worldId={id} initial={{name: '', description: '', typeId: searchParams.get('type'), fields: {}}} types={types} tags={tags} onTypesChanged={reloadTypes} submitLabel="Create entry" onSubmit={handleCreate}/>
    </Page>
  );
}
