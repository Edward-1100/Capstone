import { useEffect, useState } from 'react';
import { createCommentRequest, deleteCommentRequest, listCommentsRequest, updateCommentRequest } from '../api/comments';
import { useAuth } from '../context/AuthContext';

export default function EntryComments({worldId, entryId, role}) {
  const {user} = useAuth();

  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listCommentsRequest(worldId, entryId)
      .then(setComments)
      .catch((err) => setError(err.message));
  }, [worldId, entryId]);

  const canEdit = role === 'owner' || role === 'editor';

  async function reload() {
    setComments(await listCommentsRequest(worldId, entryId));
  }

  async function handleAdd(event) {
    event.preventDefault();
    setError('');

    try {
      await createCommentRequest(worldId, entryId, text);
      setText('');
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(comment) {
    setError('');
    setDeletingId(null);
    setEditingId(comment.id);
    setEditText(comment.body);
  }

  async function handleSave(event, commentId) {
    event.preventDefault();
    setError('');

    try {
      await updateCommentRequest(worldId, commentId, editText);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(commentId) {
    setError('');

    try {
      await deleteCommentRequest(worldId, commentId);
      setDeletingId(null);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!comments) {
    return <p>{error || 'Loading'}</p>;
  }

  return (
    <div>
      <h2>Comments</h2>

      {comments.length === 0 && <p className="muted">No comments yet</p>}

      <ul className="comments">
        {comments.map((comment) => {
          const isAuthor = Boolean(user) && comment.authorId === user.id;
          const canDelete = canEdit && (isAuthor || role === 'owner');

          return (
            <li key={comment.id} className="comment">
              <div className="line">
                <span className="by">{comment.authorName || 'Deleted user'}, {new Date(comment.createdAt).toLocaleString()}{comment.edited && ' (edited)'}</span>

                {editingId !== comment.id && canEdit && isAuthor && <button type="button" onClick={() => startEdit(comment)}>Edit</button>}

                {editingId !== comment.id && canDelete && deletingId !== comment.id && <button type="button" onClick={() => setDeletingId(comment.id)}>Delete</button>}

                {deletingId === comment.id && (
                  <>
                    <span>Delete this comment?</span>
                    <button type="button" className="danger" onClick={() => handleDelete(comment.id)}>Yes, delete</button>
                    <button type="button" onClick={() => setDeletingId(null)}>Cancel</button>
                  </>
                )}
              </div>

              {editingId !== comment.id && <p className="comment-body">{comment.body}</p>}

              {editingId === comment.id && (
                <form onSubmit={(e) => handleSave(e, comment.id)}>
                  <textarea aria-label="Comment" value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={5000}/>

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

      {canEdit && (
        <form className="add-form" onSubmit={handleAdd}>
          <textarea aria-label="Add a comment" placeholder="Add a comment" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000}/>

          <div className="actions">
            <button type="submit" disabled={text.trim() === ''}>Add comment</button>
          </div>
        </form>
      )}
    </div>
  );
}
