import { Link, useNavigate } from 'react-router-dom';
import { createWorldRequest } from '../../api/worlds';
import WorldForm from '../../components/WorldForm';

export default function NewWorldPage() {
  const navigate = useNavigate();

  async function handleCreate(data) {
    const world = await createWorldRequest(data);

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
