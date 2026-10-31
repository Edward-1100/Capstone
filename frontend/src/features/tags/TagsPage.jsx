import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createTagRequest, deleteTagRequest, listTagsRequest, updateTagRequest } from '../../api/tags';
import { getWorldRequest } from '../../api/worlds';
import TagSwatch from '../../components/TagSwatch';

export default function TagsPage() {
  const {id} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [tags, setTags] = useState([]);
  const [newName, setNewName] = useState('');
  const [newUseColor, setNewUseColor] = useState(false);
  const [newColor, setNewColor] = useState('#808080');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUseColor, setEditUseColor] = useState(false);
  const [editColor, setEditColor] = useState('#808080');
  const [deletingTag, setDeletingTag] = useState(null);
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getWorldRequest(id), listTagsRequest(id)])
      .then(([worldData, tagData]) => {
        setWorld(worldData);
        setTags(tagData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  async function reload() {
    setTags(await listTagsRequest(id));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError('');

    try {
      await createTagRequest(id, {name: newName, color: newUseColor ? newColor : undefined});
      setNewName('');
      setNewUseColor(false);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(tag) {
    setError('');
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditUseColor(Boolean(tag.color));
    setEditColor(tag.color || '#808080');
  }

  async function handleUpdate(event, tagId) {
    event.preventDefault();
    setError('');

    try {
      await updateTagRequest(id, tagId, {name: editName, color: editUseColor ? editColor : null});
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function startDelete(tag) {
    setError('');
    setDeletingTag(tag);
    setConfirmName('');
  }

  async function handleDelete(event) {
    event.preventDefault();
    setError('');

    try {
      await deleteTagRequest(id, deletingTag.id, confirmName);
      setDeletingTag(null);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!world) {
    return <p>Loading</p>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';

  return (
    <div>
      <p><Link to={`/worlds/${id}`}>Back to {world.name}</Link></p>

      <h1>Tags</h1>

      {error && <p role="alert">{error}</p>}

      {tags.length === 0 && <p>No tags yet</p>}

      <ul>
        {tags.map((tag) => (
          <li key={tag.id}>
            {editingId !== tag.id && <span><TagSwatch color={tag.color}/> {tag.name} ({tag.entryCount} entries)</span>}

            {editingId === tag.id && (
              <form onSubmit={(e) => handleUpdate(e, tag.id)}>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} required/>

                <label htmlFor={`useColor-${tag.id}`}>Color</label>
                <input id={`useColor-${tag.id}`} type="checkbox" checked={editUseColor} onChange={(e) => setEditUseColor(e.target.checked)}/>
                {editUseColor && <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)}/>}

                <button type="submit">Save</button>
                <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
              </form>
            )}

            {canEdit && editingId !== tag.id && <button onClick={() => startEdit(tag)}>Edit</button>}

            {canEdit && editingId !== tag.id && <button onClick={() => startDelete(tag)}>Delete</button>}
          </li>
        ))}
      </ul>

      {canEdit && (
        <form onSubmit={handleCreate}>
          <label htmlFor="newTag">New tag</label>
          <input id="newTag" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50} required/>

          <label htmlFor="newUseColor">Color</label>
          <input id="newUseColor" type="checkbox" checked={newUseColor} onChange={(e) => setNewUseColor(e.target.checked)}/>
          {newUseColor && <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}/>}

          <button type="submit">Add tag</button>
        </form>
      )}

      {deletingTag && (
        <section>
          <h2>Delete {deletingTag.name}</h2>

          <p>{deletingTag.entryCount} entries have this tag. It will be removed from them.</p>

          <form onSubmit={handleDelete}>
            <p>Type the tag's name ({deletingTag.name}) to confirm.</p>

            <input type="text" value={confirmName} onChange={(e) => setConfirmName(e.target.value)}/>

            <button type="submit" disabled={confirmName !== deletingTag.name}>Delete tag</button>
            <button type="button" onClick={() => setDeletingTag(null)}>Cancel</button>
          </form>
        </section>
      )}
    </div>
  );
}
