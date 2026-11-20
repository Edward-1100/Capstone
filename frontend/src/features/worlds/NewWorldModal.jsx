import { useNavigate } from 'react-router-dom';
import { createWorldRequest, uploadThumbnailRequest } from '../../api/worlds';
import Modal from '../../components/Modal';
import WorldForm from '../../components/WorldForm';

export default function NewWorldModal({onClose}) {
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

  const footer = (
    <>
      <button type="button" onClick={onClose}>Cancel</button>
      <button type="submit" form="new-world-form" className="primary">Create world</button>
    </>
  );

  return (
    <Modal title="New world" size="small" onClose={onClose} footer={footer}>
      <WorldForm formId="new-world-form" hideSubmit initial={{name: '', description: '', visibility: 'private'}} submitLabel="Create world" onSubmit={handleCreate}/>
    </Modal>
  );
}
