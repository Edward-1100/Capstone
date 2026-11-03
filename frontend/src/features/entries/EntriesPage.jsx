import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listEntriesRequest } from '../../api/entries';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { getWorldRequest } from '../../api/worlds';
import Page from '../../components/Page';

export default function EntriesPage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = searchParams.get('type') || '';

  const [world, setWorld] = useState(null);
  const [types, setTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getWorldRequest(id), listEntryTypesRequest(id)])
      .then(([worldData, typeData]) => {
        setWorld(worldData);
        setTypes(typeData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  useEffect(() => {
    listEntriesRequest(id, typeFilter)
      .then((data) => {
        setEntries(data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, typeFilter]);

  function handleFilterChange(event) {
    const value = event.target.value;

    setSearchParams(value ? {type: value} : {});
  }

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';
  const newLink = typeFilter && typeFilter !== 'none' ? `/worlds/${id}/entries/new?type=${typeFilter}` : `/worlds/${id}/entries/new`;

  return (
    <Page size="medium" crumbs={[{to: `/worlds/${id}`, label: world.name}, {label: 'Entries'}]}>
      <div className="panel">
        <div className="toolbar">
          <div className="line">
            <label htmlFor="typeFilter">Show</label>

            <select id="typeFilter" value={typeFilter} onChange={handleFilterChange}>
              <option value="">All entries</option>
              <option value="none">No type</option>
              {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </div>

          {canEdit && <Link className="button" to={newLink}>New entry</Link>}
        </div>

        {loading && <p>Loading</p>}

        {error && <p role="alert">{error}</p>}

        {!loading && !error && entries.length === 0 && <p className="muted">No entries yet</p>}

        <ul className="entry-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link to={`/worlds/${id}/entries/${entry.id}`}>{entry.name}</Link>

              <span className="muted">{entry.typeName || 'no type'}</span>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  );
}
