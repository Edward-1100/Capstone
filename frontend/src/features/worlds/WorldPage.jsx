import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDashboardRequest, getWorldRequest } from '../../api/worlds';
import Page from '../../components/Page';
import ThemePicker from '../../components/ThemePicker';
import { useAuth } from '../../context/AuthContext';
import HighlightsWidget from './dashboard/HighlightsWidget';
import SuggestionsInbox from './dashboard/SuggestionsInbox';

const RECENT = [
  {key: 'recentlyCreated', label: 'Created', empty: 'No entries have been created'},
  {key: 'recentlyModified', label: 'Modified', empty: 'No entries have been modified'},
  {key: 'recentlyDeleted', label: 'Deleted', empty: 'No entries have been deleted'},
];

function formatDate(value) {
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();

  return date.toLocaleDateString(undefined, sameYear ? {month: 'short', day: 'numeric'} : {year: 'numeric', month: 'short', day: 'numeric'});
}

function label(item) {
  return item.currentName && item.currentName !== item.name ? `${item.name} (${item.currentName})` : item.name;
}

function RecentActivity({dashboard, worldId}) {
  const [tab, setTab] = useState('recentlyCreated');
  const current = RECENT.find((item) => item.key === tab);
  const items = dashboard[tab];

  return (
    <section className="dash-section">
      <div className="dash-head">
        <h3>Recent activity</h3>

        <div className="segmented">
          {RECENT.map((item) => <button key={item.key} type="button" aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>{item.label}</button>)}
        </div>
      </div>

      {items.length === 0 && <p className="muted">{current.empty}</p>}

      <ul className="activity">
        {items.map((item) => (
          <li key={item.id}>
            {item.entryId ? <Link to={`/worlds/${worldId}/entries/${item.entryId}`}>{label(item)}</Link> : <span>{item.name}</span>}
            <span className="muted">{item.by ? `${item.by}, ` : ''}{formatDate(item.at)}</span>
          </li>
        ))}
      </ul>
    </section>
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

  async function reload() {
    setDashboard(await getDashboardRequest(id));
  }

  if (!world || !dashboard) {
    return <Page><p>Loading</p></Page>;
  }

  const visibility = world.visibility === 'private' ? 'Private' : 'Public';
  const show = dashboard.show;
  const isEditor = world.role === 'editor' || world.role === 'owner';
  const showFeatured = show.featured && (dashboard.featured.length > 0 || isEditor);
  const attention = dashboard.untyped.length + dashboard.missingRequired.length + dashboard.outOfRange.length + dashboard.invalidRelationships.length + dashboard.pausedRules.length;

  return (
    <Page crumbs={user ? [{to: '/', label: 'Your worlds'}, {label: world.name}] : []} actions={<ThemePicker/>}>
      <div className="panel header">
        {world.thumbnailUrl && <img className="cover" src={world.thumbnailUrl} alt=""/>}

        <div className="world-intro">
          <h1 className="title">{world.name}</h1>

          <p className="badges">
            <span className="badge">{visibility}</span>
            <span className="badge">{world.role}</span>
          </p>

          {world.description && <p className="world-description">{world.description}</p>}
        </div>

        {show.announcement && (
          <div className="announcement" role="note">
            <span className="announcement-label">Announcement</span>
            <p>{dashboard.announcement}</p>
          </div>
        )}
      </div>

      <nav className="tabs">
        <span className="current">Dashboard</span>
        <Link to={`/worlds/${world.id}/entries`}>Entries</Link>
        <Link to={`/worlds/${world.id}/types`}>Entry types</Link>
        <Link to={`/worlds/${world.id}/relationship-types`}>Relationship types</Link>
        <Link to={`/worlds/${world.id}/tags`}>Tags</Link>
        <Link to={`/worlds/${world.id}/maps`}>Maps</Link>
        <Link to={`/worlds/${world.id}/graph`}>Graph</Link>
        <Link to={`/worlds/${world.id}/timeline`}>Timeline</Link>
        {world.role === 'owner' && <Link to={`/worlds/${world.id}/edit`}>World settings</Link>}
        {!user && <Link to="/login">Log in</Link>}
      </nav>

      <div className="panel dashboard">
        {show.entries && (
          <section className="dash-section">
            <h3>Entries</h3>

            {dashboard.entriesByType.length === 0 && (
              <p className="muted">
                No entries yet
                {world.role !== 'viewer' && <> <Link to={`/worlds/${world.id}/entries/new`}>Create the first entry</Link></>}
              </p>
            )}

            <ul className="chips">
              {dashboard.entriesByType.map((item) => (
                <li key={item.typeId || 'none'}>
                  <Link to={`/worlds/${world.id}/entries?types=${item.typeId || 'none'}`}>{item.name || 'No type'}</Link>
                  <b>{item.count}</b>
                </li>
              ))}
            </ul>
          </section>
        )}

        {show.attention && attention > 0 && (
          <section className="attention">
            <h3>Needs attention<span className="badge alert">{attention}</span></h3>

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
          </section>
        )}

        {(showFeatured || show.pinned) && <HighlightsWidget worldId={world.id} featured={dashboard.featured} pinned={dashboard.pinned} showFeatured={showFeatured} showPinned={show.pinned} canEdit={isEditor} onChanged={reload}/>}

        {show.activity && <RecentActivity dashboard={dashboard} worldId={world.id}/>}

        {(show.suggest || (show.review && dashboard.openSuggestions > 0)) && (
          <SuggestionsInbox worldId={world.id} reviewing={show.review && dashboard.openSuggestions > 0} canPin={show.pinned} signedIn={Boolean(user)} canSuggest={show.suggest} onChanged={reload}/>
        )}
      </div>

    </Page>
  );
}
