import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getWorldRequest } from '../../api/worlds';
import { useAuth } from '../../context/AuthContext';

export default function WorldPage() {
  const {id} = useParams();
  const {user} = useAuth();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);

  useEffect(() => {
    getWorldRequest(id)
      .then(setWorld)
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  if (!world) {
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
          {world.role === 'owner' && <li><Link to={`/worlds/${world.id}/edit`}>Edit world</Link></li>}
          {!user && <li><Link to="/login">Log in</Link></li>}
        </ul>

        <p>Coming soon: entries, relationships, maps, graph, timeline</p>
      </nav>

      <section>
        <h2>Statistics</h2>

        <p>Entries: 0</p>
        <p>Created: {new Date(world.createdAt).toLocaleDateString()}</p>
        <p>Last updated: {new Date(world.updatedAt).toLocaleDateString()}</p>
      </section>

      <section>
        <h2>Recently created</h2>
        <p>No entries yet</p>
      </section>

      <section>
        <h2>Recently modified</h2>
        <p>No entries yet</p>
      </section>

      <section>
        <h2>Recently deleted</h2>
        <p>No entries yet</p>
      </section>
    </div>
  );
}
