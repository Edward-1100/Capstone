import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDashboardRequest, getWorldRequest } from '../../api/worlds';
import { useAuth } from '../../context/AuthContext';

function RecentList({items, worldId}) {
  if (items.length === 0) {
    return <p>No entries yet</p>;
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.entryId ? <Link to={`/worlds/${worldId}/entries/${item.entryId}`}>{item.name}</Link> : item.name}
          {item.by && ` by ${item.by}`}, {new Date(item.at).toLocaleDateString()}
        </li>
      ))}
    </ul>
  );
}

export default function WorldPage() {
  const {id} = useParams();
  const {user} = useAuth();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    Promise.all([getWorldRequest(id), getDashboardRequest(id)])
      .then(([worldData, dashboardData]) => {
        setWorld(worldData);
        setDashboard(dashboardData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  if (!world || !dashboard) {
    return <p>Loading</p>;
  }

  return (
    <div>
      {user && <p><Link to="/">Back to worlds</Link></p>}

      <h1>{world.name}</h1>

      {world.thumbnailUrl && <img src={world.thumbnailUrl} alt="World thumbnail" width="300"/>}

      <p>{world.visibility} world, your role: {world.role}</p>

      <p>{world.description}</p>

      <nav>
        <h2>Navigation</h2>

        <ul>
          <li>Dashboard</li>
          <li><Link to={`/worlds/${world.id}/entries`}>Entries</Link></li>
          <li><Link to={`/worlds/${world.id}/types`}>Entry types</Link></li>
          {world.role === 'owner' && <li><Link to={`/worlds/${world.id}/edit`}>Edit world</Link></li>}
          {!user && <li><Link to="/login">Log in</Link></li>}
        </ul>

        <p>Coming soon: relationships, maps, graph, timeline</p>
      </nav>

      <section>
        <h2>Statistics</h2>

        <p>Entries: {dashboard.entryCount}</p>
        <p>Created: {new Date(world.createdAt).toLocaleDateString()}</p>
        <p>Last updated: {new Date(world.updatedAt).toLocaleDateString()}</p>
      </section>

      <section>
        <h2>Recently created</h2>
        <RecentList items={dashboard.recentlyCreated} worldId={world.id}/>
      </section>

      <section>
        <h2>Recently modified</h2>
        <RecentList items={dashboard.recentlyModified} worldId={world.id}/>
      </section>

      <section>
        <h2>Recently deleted</h2>
        <RecentList items={dashboard.recentlyDeleted} worldId={world.id}/>
      </section>

      <section>
        <h2>Needs attention</h2>

        {dashboard.untyped.length === 0 && dashboard.missingRequired.length === 0 && dashboard.outOfRange.length === 0 && <p>Nothing needs attention</p>}

        {dashboard.untyped.length > 0 && <p>Entries without a type:</p>}

        <ul>
          {dashboard.untyped.map((entry) => <li key={entry.id}><Link to={`/worlds/${world.id}/entries/${entry.id}`}>{entry.name}</Link></li>)}
        </ul>

        {dashboard.missingRequired.length > 0 && <p>Entries missing a required field:</p>}

        <ul>
          {dashboard.missingRequired.map((item) => <li key={`${item.entryId}-${item.fieldName}`}><Link to={`/worlds/${world.id}/entries/${item.entryId}`}>{item.name}</Link>, missing {item.fieldName}</li>)}
        </ul>

        {dashboard.outOfRange.length > 0 && <p>Entries with a value outside a scale's range:</p>}

        <ul>
          {dashboard.outOfRange.map((item) => <li key={`${item.entryId}-${item.fieldName}`}><Link to={`/worlds/${world.id}/entries/${item.entryId}`}>{item.name}</Link>, {item.fieldName}</li>)}
        </ul>
      </section>
    </div>
  );
}
