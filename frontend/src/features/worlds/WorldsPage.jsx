import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listWorldsRequest } from '../../api/worlds';
import Page from '../../components/Page';
import { useAuth } from '../../context/AuthContext';

export default function WorldsPage() {
  const {user, logout} = useAuth();
  const navigate = useNavigate();

  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <Page size="medium">
      <div className="panel">
        <div className="toolbar">
          <h1 className="title">Worldbuilder</h1>

          <div className="line">
            <span className="muted">Logged in as {user.username} ({user.email})</span>

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

          {!loading && worlds.length === 0 && <p className="muted">You have no worlds yet</p>}

          <ul className="worlds">
            {worlds.map((world) => (
              <li key={world.id}>
                {world.thumbnailUrl ? <img className="thumb" src={world.thumbnailUrl} alt=""/> : <span className="thumb"></span>}

                <Link to={`/worlds/${world.id}`}>{world.name}</Link>

                <span className="muted">{world.visibility}, {world.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Page>
  );
}
