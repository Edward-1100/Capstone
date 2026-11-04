import { useEffect, useState } from 'react';
import { createNoteRequest, deleteNoteRequest, listNotesRequest, updateNoteRequest } from '../api/notes';
import { useAuth } from '../context/AuthContext';

export default function EntryNotes({worldId, entryId, role}) {
  const {user} = useAuth();

  const [notes, setNotes] = useState(null);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listNotesRequest(worldId, entryId)
      .then(setNotes)
      .catch((err) => setError(err.message));
  }, [worldId, entryId]);

  async function reload() {
    setNotes(await listNotesRequest(worldId, entryId));
  }

  async function handleAdd(event) {
    event.preventDefault();
    setError('');

    try {
      await createNoteRequest(worldId, entryId, text);
      setText('');
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(note) {
    setError('');
    setDeletingId(null);
    setEditingId(note.id);
    setEditText(note.body);
  }

  async function handleSave(event, noteId) {
    event.preventDefault();
    setError('');

    try {
      await updateNoteRequest(worldId, noteId, editText);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(noteId) {
    setError('');

    try {
      await deleteNoteRequest(worldId, noteId);
      setDeletingId(null);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!notes) {
    return <p>{error || 'Loading'}</p>;
  }

  return (
    <div>
      <h2>Notes</h2>

      <p className="muted">Only owners and editors can see notes</p>

      {notes.length === 0 && <p className="muted">No notes yet</p>}

      <ul>
        {notes.map((note) => {
          const isAuthor = Boolean(user) && note.authorId === user.id;
          const canDelete = isAuthor || role === 'owner';

          return (
            <li key={note.id} className="comment">
              <div className="line">
                <span className="by">{note.authorName || 'Deleted user'}, {new Date(note.createdAt).toLocaleString()}{note.edited && ' (edited)'}</span>

                {editingId !== note.id && isAuthor && <button type="button" onClick={() => startEdit(note)}>Edit</button>}

                {editingId !== note.id && canDelete && deletingId !== note.id && <button type="button" onClick={() => setDeletingId(note.id)}>Delete</button>}

                {deletingId === note.id && (
                  <>
                    <span>Delete this note?</span>
                    <button type="button" className="danger" onClick={() => handleDelete(note.id)}>Yes, delete</button>
                    <button type="button" onClick={() => setDeletingId(null)}>Cancel</button>
                  </>
                )}
              </div>

              {editingId !== note.id && <p className="comment-body">{note.body}</p>}

              {editingId === note.id && (
                <form onSubmit={(e) => handleSave(e, note.id)}>
                  <textarea aria-label="Note" value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={5000}/>

                  <div className="actions">
                    <button type="submit" disabled={editText.trim() === ''}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p role="alert">{error}</p>}

      <form className="add-form" onSubmit={handleAdd}>
        <textarea aria-label="Add a note" placeholder="Add a note" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000}/>

        <div className="actions">
          <button type="submit" disabled={text.trim() === ''}>Add note</button>
        </div>
      </form>
    </div>
  );
}
