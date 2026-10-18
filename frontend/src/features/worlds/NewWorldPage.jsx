import { Link, useNavigate } from 'react-router-dom';
import { createWorldRequest, uploadThumbnailRequest } from '../../api/worlds';
import WorldForm from '../../components/WorldForm';

export default function NewWorldPage() {
  const navigate = useNavigate();

  async function handleCreate(data) {
    const world = await createWorldRequest({name: data.name, description: data.description, visibility: data.visibility});

    if (data.file) {
      try {
        await uploadThumbnailRequest(world.id, data.file);
      } catch (err) {
        navigate(`/worlds/${world.id}/edit`, {state: {notice: `World created, but the thumbnail upload failed: ${err.message}`}});

        return;
      }
    }

    navigate(`/worlds/${world.id}`);
  }

  return (
    <div>
      <h1>New world</h1>

      <WorldForm initial={{name: '', description: '', visibility: 'private'}} submitLabel="Create world" onSubmit={handleCreate}/>

      <p><Link to="/">Back to worlds</Link></p>
    </div>
  );
}
