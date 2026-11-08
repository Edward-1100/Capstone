import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { acceptInviteRequest, denyInviteRequest, leaveWorldRequest } from '../../api/members';
import { listWorldsRequest } from '../../api/worlds';
import Page from '../../components/Page';
import { useAuth } from '../../context/AuthContext';

function Thumb({world}) {
  return world.thumbnailUrl ? <img className="thumb" src={world.thumbnailUrl} alt=""/> : <span className="thumb"></span>;
}

export default function WorldsPage() {
  const {user, logout} = useAuth();
  const navigate = useNavigate();

  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leavingId, setLeavingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listWorldsRequest()
      .then(setWorlds)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    logout();
    navigate('/login', {replace: true});
  }

  async function runAction(action) {
    setError('');

    try {
      await action();
      setLeavingId(null);
      setWorlds(await listWorldsRequest());
    } catch (err) {
      setError(err.message);
    }
  }

  const owned = worlds.filter((world) => world.role === 'owner');
  const shared = worlds.filter((world) => world.role !== 'owner');

  return (
    <Page size="medium">
      <div className="panel">
        <div className="toolbar">
          <h1 className="title">Worldbuilder</h1>

          <div className="line">
            <span className="muted">Logged in as {user.username} ({user.email})</span>

            <Link to="/blocked">Blocked users</Link>

            <button type="button" onClick={handleLogout}>Log out</button>
          </div>
        </div>

        <div>
          <div className="line">
            <h2>Your worlds</h2>

            <Link className="button" to="/worlds/new">New world</Link>
          </div>

          {loading && <p>Loading</p>}

          {error && <p role="alert">{error}</p>}

          {!loading && owned.length === 0 && <p className="muted">You have no worlds yet</p>}

          <ul className="worlds">
            {owned.map((world) => (
              <li key={world.id}>
                <Thumb world={world}/>

                <Link to={`/worlds/${world.id}`}>{world.name}</Link>

                <span className="muted">{world.visibility}</span>
              </li>
            ))}
          </ul>
        </div>

        {shared.length > 0 && (
          <div>
            <h2>Shared with you</h2>

            <ul className="worlds">
              {shared.map((world) => (
                <li key={world.id}>
                  <Thumb world={world}/>

                  <Link to={`/worlds/${world.id}`}>{world.name}</Link>

                  <span className="muted">{world.visibility}, {world.role}{world.pendingRole && `, invited as ${world.pendingRole}`}</span>

                  <span className="row-actions">
                    {world.pendingRole && <button type="button" onClick={() => runAction(() => acceptInviteRequest(world.id))}>Accept</button>}

                    {world.pendingRole && <button type="button" onClick={() => runAction(() => denyInviteRequest(world.id))}>Deny</button>}

                    {!world.pendingRole && leavingId !== world.id && <button type="button" onClick={() => setLeavingId(world.id)}>Leave</button>}

                    {leavingId === world.id && (
                      <>
                        <span>Leave this world?</span>
                        <button type="button" className="danger" onClick={() => runAction(() => leaveWorldRequest(world.id))}>Yes, leave</button>
                        <button type="button" onClick={() => setLeavingId(null)}>Stay</button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Page>
  );
}
