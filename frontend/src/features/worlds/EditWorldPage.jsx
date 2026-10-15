import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteWorldRequest, getWorldRequest, updateWorldRequest } from '../../api/worlds';
import WorldForm from '../../components/WorldForm';

export default function EditWorldPage() {
  const {id} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    getWorldRequest(id)
      .then((data) => {
        if (data.role !== 'owner') {
          navigate(`/worlds/${id}`, {replace: true});

          return;
        }

        setWorld(data);
      })
      .catch(() => navigate('/', {replace: true}));
  }, [id, navigate]);

  async function handleUpdate(data) {
    await updateWorldRequest(id, data);

    navigate(`/worlds/${id}`);
  }

  async function handleDelete(event) {
    event.preventDefault();
    setDeleteError('');

    try {
      await deleteWorldRequest(id, confirmName);
      navigate('/', {replace: true});
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  if (!world) {
    return <p>Loading</p>;
  }

  return (
    <div>
      <h1>Edit world</h1>

      <WorldForm initial={{name: world.name, description: world.description, visibility: world.visibility}} submitLabel="Save changes" onSubmit={handleUpdate}/>

      <p><Link to={`/worlds/${id}`}>Cancel</Link></p>

      <h2>Delete world</h2>

      <p>This permanently deletes the world. Type its name ({world.name}) to confirm.</p>

      <form onSubmit={handleDelete}>
        <input type="text" value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

        {deleteError && <p role="alert">{deleteError}</p>}

        <button type="submit" disabled={confirmName !== world.name}>Delete world</button>
      </form>
    </div>
  );
}
