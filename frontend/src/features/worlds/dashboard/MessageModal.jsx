import { useState } from 'react';
import Modal from '../../../components/Modal';

export default function MessageModal({title, message, onSave, onClose}) {
  const [text, setText] = useState(message);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      await onSave(text);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const footer = (
    <>
      <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button type="submit" form="highlight-message-form" className="primary" disabled={busy}>Save</button>
    </>
  );

  return (
    <Modal title={title} size="small" onClose={busy ? undefined : onClose} footer={footer}>
      <form id="highlight-message-form" onSubmit={handleSubmit}>
        <label>
          Message
          <textarea rows={4} value={text} onChange={(event) => setText(event.target.value)}/>
        </label>

        {error && <p role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
