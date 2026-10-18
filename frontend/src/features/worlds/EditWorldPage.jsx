import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { deleteThumbnailRequest, deleteWorldRequest, getWorldRequest, updateWorldRequest, uploadThumbnailRequest } from '../../api/worlds';
import WorldForm from '../../components/WorldForm';

export default function EditWorldPage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.notice;

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
    await updateWorldRequest(id, {name: data.name, description: data.description, visibility: data.visibility});

    if (data.file) {
      await uploadThumbnailRequest(id, data.file);
    }

    navigate(`/worlds/${id}`);
  }

  async function handleRemoveThumbnail() {
    await deleteThumbnailRequest(id);
    setWorld(Object.assign({}, world, {thumbnailUrl: null}));
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

      {notice && <p role="alert">{notice}</p>}

      <WorldForm initial={{name: world.name, description: world.description, visibility: world.visibility}} currentThumbnailUrl={world.thumbnailUrl} submitLabel="Save changes" onSubmit={handleUpdate} onRemoveThumbnail={handleRemoveThumbnail}/>

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
