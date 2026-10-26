import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getEntryRequest, updateEntryRequest } from '../../api/entries';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { getWorldRequest } from '../../api/worlds';
import EntryForm from '../../components/EntryForm';

export default function EditEntryPage() {
  const {id, entryId} = useParams();
  const navigate = useNavigate();

  const [entry, setEntry] = useState(null);
  const [types, setTypes] = useState([]);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    Promise.all([getWorldRequest(id), getEntryRequest(id, entryId), listEntryTypesRequest(id)])
      .then(([worldData, entryData, typeData]) => {
        if (worldData.role === 'viewer') {
          navigate(`/worlds/${id}/entries/${entryId}`, {replace: true});

          return;
        }

        setEntry(entryData);
        setTypes(typeData);
      })
      .catch(() => navigate(`/worlds/${id}/entries`, {replace: true}));
  }, [id, entryId, navigate]);

  async function handleUpdate(data) {
    try {
      await updateEntryRequest(id, entryId, {name: data.name, description: data.description, typeId: data.typeId, version: entry.version});
    } catch (err) {
      if (err.status === 409) {
        setConflict(true);
      }

      throw err;
    }

    navigate(`/worlds/${id}/entries/${entryId}`);
  }

  async function handleReload() {
    setEntry(await getEntryRequest(id, entryId));
    setConflict(false);
  }

  if (!entry) {
    return <p>Loading</p>;
  }

  return (
    <div>
      <h1>Edit entry</h1>

      <EntryForm key={entry.version} initial={{name: entry.name, description: entry.description, typeId: entry.typeId}} types={types} submitLabel="Save changes" onSubmit={handleUpdate}/>

      {conflict && <button onClick={handleReload}>Load latest version</button>}

      <p><Link to={`/worlds/${id}/entries/${entryId}`}>Cancel</Link></p>
    </div>
  );
}
