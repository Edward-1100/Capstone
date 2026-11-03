import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createEntryRequest } from '../../api/entries';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { getWorldRequest } from '../../api/worlds';
import EntryForm from '../../components/EntryForm';
import Page from '../../components/Page';

export default function NewEntryPage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [world, setWorld] = useState(null);
  const [types, setTypes] = useState([]);

  useEffect(() => {
    Promise.all([getWorldRequest(id), listEntryTypesRequest(id)])
      .then(([worldData, typeData]) => {
        if (worldData.role === 'viewer') {
          navigate(`/worlds/${id}/entries`, {replace: true});

          return;
        }

        setWorld(worldData);
        setTypes(typeData);
      })
      .catch(() => navigate('/', {replace: true}));
  }, [id, navigate]);

  async function handleCreate(data) {
    const entry = await createEntryRequest(id, data);

    navigate(`/worlds/${id}/entries/${entry.id}`);
  }

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  return (
    <Page size="medium" crumbs={[{to: `/worlds/${id}`, label: world.name}, {to: `/worlds/${id}/entries`, label: 'Entries'}, {label: 'New entry'}]}>
      <div className="panel">
        <h1 className="title">New entry</h1>

        <EntryForm initial={{name: '', description: '', typeId: searchParams.get('type'), fields: {}}} types={types} submitLabel="Create entry" onSubmit={handleCreate}/>
      </div>
    </Page>
  );
}
