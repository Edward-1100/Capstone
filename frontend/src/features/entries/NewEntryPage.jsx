import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createEntryRequest } from '../../api/entries';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { getWorldRequest } from '../../api/worlds';
import EntryForm from '../../components/EntryForm';

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
    return <p>Loading</p>;
  }

  return (
    <div>
      <h1>New entry</h1>

      <EntryForm initial={{name: '', description: '', typeId: searchParams.get('type')}} types={types} submitLabel="Create entry" onSubmit={handleCreate}/>

      <p><Link to={`/worlds/${id}/entries`}>Back to entries</Link></p>
    </div>
  );
}
