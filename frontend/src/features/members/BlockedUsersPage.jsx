import { useEffect, useState } from 'react';
import { addBlockRequest, listBlocksRequest, removeBlockRequest } from '../../api/members';
import Page from '../../components/Page';

export default function BlockedUsersPage() {
  const [blocks, setBlocks] = useState(null);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listBlocksRequest()
      .then(setBlocks)
      .catch((err) => setError(err.message));
  }, []);

  async function handleAdd(event) {
    event.preventDefault();
    setError('');

    try {
      setBlocks(await addBlockRequest(username));
      setUsername('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(userId) {
    setError('');

    try {
      setBlocks(await removeBlockRequest(userId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Page size="medium" crumbs={[{to: '/', label: 'Your worlds'}, {label: 'Blocked users'}]}>
      <div className="panel">
        <h1 className="title">Blocked users</h1>

        <form className="inline-form" onSubmit={handleAdd}>
          <input type="text" aria-label="Username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={45}/>

          <button type="submit" disabled={username.trim() === ''}>Block</button>
        </form>

        {error && <p role="alert">{error}</p>}

        {!blocks && !error && <p>Loading</p>}

        {blocks && blocks.length === 0 && <p className="muted">No blocked users</p>}

        <ul className="member-list">
          {(blocks ?? []).map((block) => (
            <li key={block.userId}>
              <span>{block.username}</span>

              <button type="button" onClick={() => handleRemove(block.userId)}>Unblock</button>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  );
}
