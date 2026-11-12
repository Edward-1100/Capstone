import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDashboardRequest, getWorldRequest } from '../../api/worlds';
import Page from '../../components/Page';
import { useAuth } from '../../context/AuthContext';

function RecentList({items, worldId}) {
  if (items.length === 0) {
    return <p className="muted">No entries yet</p>;
  }

  return (
    <ul className="plain">
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
    return <Page><p>Loading</p></Page>;
  }

  const visibility = world.visibility === 'private' ? 'Private' : 'Public';
  const attention = dashboard.untyped.length + dashboard.missingRequired.length + dashboard.outOfRange.length + dashboard.invalidRelationships.length + dashboard.pausedRules.length;

  return (
    <Page crumbs={user ? [{to: '/', label: 'Your worlds'}, {label: world.name}] : []}>
      <div className="panel header">
        {world.thumbnailUrl && <img className="cover" src={world.thumbnailUrl} alt=""/>}

        <div>
          <h1 className="title">{world.name}</h1>

          <p className="muted">{visibility} world, your role: {world.role}</p>

          {world.description && <p className="world-description">{world.description}</p>}
        </div>
      </div>

      <div className="panel">
        <nav className="tabs">
          <span className="current">Dashboard</span>
          <Link to={`/worlds/${world.id}/entries`}>Entries</Link>
          <Link to={`/worlds/${world.id}/types`}>Entry types</Link>
          <Link to={`/worlds/${world.id}/relationship-types`}>Relationship types</Link>
          <Link to={`/worlds/${world.id}/tags`}>Tags</Link>
          <Link to={`/worlds/${world.id}/maps`}>Maps</Link>
          {world.role === 'owner' && <Link to={`/worlds/${world.id}/collaboration`}>Collaboration</Link>}
          {world.role === 'owner' && <Link to={`/worlds/${world.id}/edit`}>Edit world</Link>}
          {!user && <Link to="/login">Log in</Link>}
          <span className="muted">Graph, timeline: coming soon</span>
        </nav>

        <div className="stats">
          <span>{dashboard.entryCount} {dashboard.entryCount === 1 ? 'entry' : 'entries'}</span>
          <span>Created {new Date(world.createdAt).toLocaleDateString()}</span>
          <span>Last updated {new Date(world.updatedAt).toLocaleDateString()}</span>
        </div>

        <div className="columns">
          <div>
            <h3>Recently created</h3>
            <RecentList items={dashboard.recentlyCreated} worldId={world.id}/>
          </div>

          <div>
            <h3>Recently modified</h3>
            <RecentList items={dashboard.recentlyModified} worldId={world.id}/>
          </div>

          <div>
            <h3>Recently deleted</h3>
            <RecentList items={dashboard.recentlyDeleted} worldId={world.id}/>
          </div>
        </div>

        <div>
          <h3>Needs attention</h3>

          {attention === 0 && <p className="muted">Nothing needs attention</p>}

          <ul className="plain">
            {dashboard.untyped.map((entry) => <li key={entry.id}>No type: <Link to={`/worlds/${world.id}/entries/${entry.id}`}>{entry.name}</Link></li>)}

            {dashboard.missingRequired.map((item) => <li key={`${item.entryId}-${item.fieldName}`}><Link to={`/worlds/${world.id}/entries/${item.entryId}`}>{item.name}</Link> is missing {item.fieldName}</li>)}

            {dashboard.outOfRange.map((item) => <li key={`${item.entryId}-${item.fieldName}`}><Link to={`/worlds/${world.id}/entries/${item.entryId}`}>{item.name}</Link> has a value outside the range of {item.fieldName}</li>)}

            {dashboard.invalidRelationships.map((item) => (
              <li key={item.id}>
                <Link to={`/worlds/${world.id}/entries/${item.fromId}`}>{item.fromName}</Link> {item.typeName} <Link to={`/worlds/${world.id}/entries/${item.toId}`}>{item.toName}</Link> no longer matches its relationship type
              </li>
            ))}

            {dashboard.pausedRules.map((item) => <li key={item.tagId}>The rule for the tag <Link to={`/worlds/${world.id}/tags?tag=${item.tagId}`}>{item.tagName}</Link> is paused because something it uses was deleted</li>)}
          </ul>
        </div>
      </div>
    </Page>
  );
}
