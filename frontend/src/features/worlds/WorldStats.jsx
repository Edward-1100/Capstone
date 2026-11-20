import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWorldStatsRequest } from '../../api/worlds';

const VERBS = {created: 'created', updated: 'edited', deleted: 'deleted'};

export default function WorldStats({id, world}) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getWorldStatsRequest(id).then(setStats).catch((err) => setError(err.message));
  }, [id]);

  const items = stats ? [
    [stats.entries, 'entries'],
    [stats.relationships, 'relationships'],
    [stats.tags, 'tags'],
    [stats.entryTypes, 'entry types'],
    [stats.relationshipTypes, 'relationship types'],
    [`${stats.maps} / ${stats.maxMaps}`, 'maps used'],
    [stats.members, stats.members === 1 ? 'member' : 'members'],
    [new Date(world.createdAt).toLocaleDateString(), 'created'],
  ] : [];

  return (
    <section className="card">
      <h2>Statistics</h2>

      {error && <p role="alert">{error}</p>}

      {!stats && !error && <p>Loading</p>}

      <div className="stats">
        {items.map(([value, label]) => (
          <div className="stat" key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {stats && stats.lastActivity && (
        <p>
          Last change: {VERBS[stats.lastActivity.action] || stats.lastActivity.action}{' '}
          {stats.lastActivity.entryId ? <Link to={`/worlds/${id}/entries/${stats.lastActivity.entryId}`}>{stats.lastActivity.name}</Link> : stats.lastActivity.name}
          {stats.lastActivity.by && ` by ${stats.lastActivity.by}`} on {new Date(stats.lastActivity.at).toLocaleString()}
        </p>
      )}
    </section>
  );
}
