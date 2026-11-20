import { useEffect, useState } from 'react';
import { listNotesRequest } from '../../../api/notes';
import Modal from '../../../components/Modal';

function excerpt(text) {
  return text.length > 140 ? text.slice(0, 140) : text;
}

export default function PinnedNoteModal({worldId, item, onSave, onClose}) {
  const [notes, setNotes] = useState(null);
  const [noteId, setNoteId] = useState(item.noteId || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listNotesRequest(worldId, item.entryId).then(setNotes).catch(() => setNotes([]));
  }, [worldId, item.entryId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    await onSave(noteId || null);
    setBusy(false);
    onClose();
  }

  const footer = (
    <>
      <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button type="submit" form="pinned-note-form" className="primary" disabled={busy || notes === null}>Save</button>
    </>
  );

  return (
    <Modal title={`Note for ${item.name}`} size="small" onClose={busy ? undefined : onClose} footer={footer}>
      <form id="pinned-note-form" onSubmit={handleSubmit}>
        {notes === null && <p>Loading</p>}

        {notes !== null && (
          <ul className="note-choices">
            <li>
              <label>
                <input type="radio" name="pinned-note" checked={noteId === ''} onChange={() => setNoteId('')}/>
                No note
              </label>
            </li>

            {notes.map((note) => (
              <li key={note.id}>
                <label>
                  <input type="radio" name="pinned-note" checked={noteId === note.id} onChange={() => setNoteId(note.id)}/>
                  <span>
                    {excerpt(note.body)}
                    <span className="muted">{note.authorName}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </form>
    </Modal>
  );
}
