import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listWorldsRequest } from '../../api/worlds';
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
    <div>
      <h1>Worldbuilder</h1>

      <p>Logged in as {user.username} ({user.email})</p>

      <button onClick={handleLogout}>Log out</button>

      <h2>Your worlds</h2>

      <p><Link to="/worlds/new">New world</Link></p>

      {loading && <p>Loading</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && worlds.length === 0 && <p>You have no worlds yet</p>}

      <ul>
        {worlds.map((world) => (
          <li key={world.id}>
            {world.thumbnailUrl && <img src={world.thumbnailUrl} alt="" width="60"/>}

            <Link to={`/worlds/${world.id}`}>{world.name}</Link> ({world.visibility}, {world.role})
          </li>
        ))}
      </ul>
    </div>
  );
}
