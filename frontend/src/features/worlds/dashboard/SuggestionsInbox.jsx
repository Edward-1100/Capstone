import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addPinnedRequest, createSuggestionRequest, listSuggestionsRequest, setSuggestionStatusRequest } from '../../../api/dashboard';
import { listEntriesRequest } from '../../../api/entries';
import Typeahead from '../../../components/Typeahead';

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

export default function SuggestionsInbox({worldId, signedIn, canSuggest, reviewing, canPin, onChanged}) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [entryId, setEntryId] = useState('');
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [closed, setClosed] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (reviewing) {
      listSuggestionsRequest(worldId, closed).then(setItems).catch((err) => setError(err.message));
    }
  }, [worldId, closed, reviewing]);

  useEffect(load, [load]);

  useEffect(() => {
    if (canSuggest && signedIn) {
      listEntriesRequest(worldId).then(setEntries).catch(() => setEntries([]));
    }
  }, [worldId, canSuggest, signedIn]);

  function handleBodyChange(event) {
    setBody(event.target.value);
    setSent(false);
  }

  async function handleSend(event) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setFormError('');
    setSent(false);
    setBusy(true);

    try {
      await createSuggestionRequest(worldId, body, entryId, anonymous);
      setBody('');
      setEntryId('');
      setSent(true);

      if (reviewing) {
        load();
      }

      await onChanged();
    } catch (err) {
      setFormError(err.message);
    }

    setBusy(false);
  }

  const chosen = entries.find((entry) => entry.id === entryId);

  async function change(action) {
    setError('');

    try {
      await action();
      load();
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="dash-section suggest-box">
      <h3>Suggestion box</h3>

      {canSuggest && !signedIn && (
        <button type="button" className="primary" onClick={() => navigate('/login', {state: {from: `/worlds/${worldId}`}})}>Log in to send a suggestion</button>
      )}

      {canSuggest && signedIn && (
        <form className="suggest-form" onSubmit={handleSend}>
          <label htmlFor="suggestion-body">Suggestion</label>
          <textarea id="suggestion-body" value={body} maxLength={2000} onChange={handleBodyChange}/>

          <div>
            <span className="label">About an entry (optional)</span>

            {chosen && (
              <p className="line">
                <span>{chosen.name}</span>
                <button type="button" className="small" onClick={() => setEntryId('')}>Clear</button>
              </p>
            )}

            {!chosen && <Typeahead options={entries.map((entry) => ({id: entry.id, label: entry.name}))} onPick={setEntryId} placeholder="Find an entry" label="About an entry" showCount={false}/>}
          </div>

          <label className="check">
            <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)}/>
            Send anonymously
          </label>

          <div className="line">
            <button type="submit" className="primary" disabled={busy || body.trim() === ''}>{busy ? 'Sending' : 'Send'}</button>
            {sent && <span role="status">Your suggestion was sent.</span>}
          </div>

          {formError && <p role="alert">{formError}</p>}
        </form>
      )}

      {reviewing && (
        <div className="suggest-review">
          <h4>Received</h4>

          <div className="segmented suggest-tabs">
            <button type="button" aria-pressed={!closed} onClick={() => setClosed(false)}>Open</button>
            <button type="button" aria-pressed={closed} onClick={() => setClosed(true)}>Closed</button>
          </div>
        </div>
      )}

      {reviewing && items && items.length === 0 && <p className="muted">{closed ? 'No closed suggestions' : 'No open suggestions'}</p>}

      <ul className="suggestions">
        {(items || []).map((item) => (
          <li key={item.id}>
            <p>{item.body}</p>

            <p className="muted">
              {item.authorName || 'Anonymous'}, {formatDate(item.createdAt)}
              {item.entryName && <> about {item.entryId ? <Link to={`/worlds/${worldId}/entries/${item.entryId}`}>{item.entryName}</Link> : item.entryName}</>}
              {closed && ` (${item.status}${item.resolvedBy ? ` by ${item.resolvedBy}` : ''})`}
            </p>

            <div className="line">
              {!closed && <button type="button" className="small" onClick={() => change(() => setSuggestionStatusRequest(worldId, item.id, 'done'))}>Done</button>}
              {!closed && <button type="button" className="small" onClick={() => change(() => setSuggestionStatusRequest(worldId, item.id, 'dismissed'))}>Dismiss</button>}
              {closed && <button type="button" className="small" onClick={() => change(() => setSuggestionStatusRequest(worldId, item.id, 'open'))}>Reopen</button>}
              {!closed && canPin && item.entryId && <button type="button" className="small" onClick={() => change(() => addPinnedRequest(worldId, {entryId: item.entryId}))}>Pin entry</button>}
            </div>
          </li>
        ))}
      </ul>

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
