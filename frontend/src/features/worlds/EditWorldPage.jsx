import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { deleteThumbnailRequest, deleteWorldRequest, getWorldRequest, updateWorldRequest, uploadThumbnailRequest } from '../../api/worlds';
import Page from '../../components/Page';
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
    return <Page><p>Loading</p></Page>;
  }

  return (
    <Page size="medium" crumbs={[{to: '/', label: 'Your worlds'}, {to: `/worlds/${id}`, label: world.name}, {label: 'Edit world'}]}>
      <div className="panel">
        <h1 className="title">Edit world</h1>

        {notice && <p role="alert">{notice}</p>}

        <WorldForm initial={{name: world.name, description: world.description, visibility: world.visibility}} currentThumbnailUrl={world.thumbnailUrl} submitLabel="Save changes" onSubmit={handleUpdate} onRemoveThumbnail={handleRemoveThumbnail}/>

        <div>
          <h2>Delete world</h2>

          <p>This permanently deletes the world. Type its name ({world.name}) to confirm.</p>

          <form className="inline-form" onSubmit={handleDelete}>
            <input type="text" aria-label="Type the world name to confirm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

            <button type="submit" className="danger" disabled={confirmName !== world.name}>Delete world</button>

            {deleteError && <p role="alert">{deleteError}</p>}
          </form>
        </div>
      </div>
    </Page>
  );
}
