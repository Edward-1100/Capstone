import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { acceptInviteRequest, denyInviteRequest, leaveWorldRequest } from '../../api/members';
import { listWorldsRequest } from '../../api/worlds';
import ThemePicker from '../../components/ThemePicker';
import Page from '../../components/Page';
import { useAuth } from '../../context/AuthContext';
import ImportModal from '../transfer/ImportModal';
import NewWorldModal from './NewWorldModal';

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
  const [dialog, setDialog] = useState('');

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
      <div className="page-head">
        <div>
          <h1 className="title">Worldbuilder</h1>

          <p className="muted">Logged in as {user.username} ({user.email})</p>
        </div>

        <div className="line">
          <ThemePicker/>

          <Link to="/blocked">Blocked users</Link>

          <button type="button" onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Your worlds</h2>

          <span className="head-actions">
            <button type="button" className="primary" onClick={() => setDialog('new')}>New world</button>

            <button type="button" onClick={() => setDialog('import')}>Import world</button>
          </span>
        </div>

        <div>
          {loading && <p>Loading</p>}

          {error && <p role="alert">{error}</p>}

          {!loading && owned.length === 0 && <p className="muted">You have no worlds yet</p>}

          <ul className="worlds">
            {owned.map((world) => (
              <li key={world.id}>
                <Thumb world={world}/>

                <Link to={`/worlds/${world.id}`}>{world.name}</Link>

                <span className="type-badge">{world.visibility}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {shared.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Shared with you</h2>
          </div>

          <ul className="worlds">
            {shared.map((world) => (
              <li key={world.id}>
                <Thumb world={world}/>

                <Link to={`/worlds/${world.id}`}>{world.name}</Link>

                <span className="type-badge">{world.visibility}, {world.role}{world.pendingRole && `, invited as ${world.pendingRole}`}</span>

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
        </section>
      )}

      {dialog === 'new' && <NewWorldModal onClose={() => setDialog('')}/>}

      {dialog === 'import' && <ImportModal onClose={() => setDialog('')}/>}
    </Page>
  );
}
