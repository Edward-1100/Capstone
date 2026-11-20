import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { addFeaturedRequest, addPinnedRequest, changeFeaturedRequest, changePinnedRequest, removeFeaturedRequest, removePinnedRequest } from '../../../api/dashboard';
import { formatValue } from '../../../utils/fields';
import AddHighlightModal from './AddHighlightModal';
import LayoutSelect from './LayoutSelect';
import MessageModal from './MessageModal';
import PinnedNoteModal from './PinnedNoteModal';

const MAX = {featured: 12, pinned: 20};

function itemName(item) {
  return item.kind === 'relationship' ? `${item.relationship.from.name} and ${item.relationship.to.name}` : item.name;
}

function Person({worldId, person}) {
  return (
    <figure>
      {person.imageUrl && <img className="spot-thumb" src={person.imageUrl} alt=""/>}
      {!person.imageUrl && <div className="spot-thumb"/>}

      <figcaption>
        <Link to={`/worlds/${worldId}/entries/${person.entryId}`}>{person.name}</Link>
        {person.typeName && <span className="badge">{person.typeName}</span>}
      </figcaption>
    </figure>
  );
}

function Card({worldId, item, kind, canEdit, onChange, onEditNote, onEditMessage}) {
  const change = kind === 'featured' ? changeFeaturedRequest : changePinnedRequest;
  const remove = kind === 'featured' ? removeFeaturedRequest : removePinnedRequest;
  const isEntry = item.kind === 'entry';
  const layout = isEntry ? item.layout : item.kind;
  const showImage = item.imageUrl && item.kind !== 'relationship' && (item.kind === 'details' || (item.layout !== 'title' && item.layout !== 'plain'));
  const showText = isEntry && item.layout !== 'title';

  return (
    <li className={`spot-card layout-${layout}${showImage ? ' has-image' : ''}`}>
      {showImage && <img className="spot-thumb" src={item.imageUrl} alt=""/>}

      {item.kind === 'relationship' && (
        <div className="spot-pair">
          <Person worldId={worldId} person={item.relationship.from}/>

          <div className="spot-rel">
            <span>{item.relationship.typeName}</span>
            <span>--&gt;</span>
          </div>

          <Person worldId={worldId} person={item.relationship.to}/>
        </div>
      )}

      <div className="spot-main">
        {item.kind !== 'relationship' && (
          <div className="spot-title">
            <Link to={`/worlds/${worldId}/entries/${item.entryId}`}>{item.name}</Link>
            {item.typeName && <span className="badge">{item.typeName}</span>}
          </div>
        )}

        {item.message && <p className="spot-message">{item.message}</p>}

        {showText && kind === 'featured' && item.excerpt && <p className="spot-text">{item.excerpt}</p>}

        {showText && kind === 'pinned' && item.noteBody && (
          <blockquote className="spot-text pin-note">
            {item.noteBody}
            {item.noteAuthor && <cite>{item.noteAuthor}</cite>}
          </blockquote>
        )}

        {item.kind === 'details' && (
          <dl className="spot-details">
            {item.details.map((detail) => (
              <div key={detail.id} className={detail.fieldType === 'long_text' ? 'spot-detail long' : 'spot-detail'}>
                <dt>{detail.name}</dt>
                <dd>{formatValue(detail, detail.value)}</dd>
              </div>
            ))}
          </dl>
        )}

        {canEdit && (
          <div className="spot-actions">
            {isEntry && <LayoutSelect kind={kind} value={item.layout} onChange={(value) => onChange(() => change(worldId, item.id, {layout: value}))}/>}
            <button type="button" className="small" onClick={onEditMessage}>{item.message ? 'Change message' : 'Add message'}</button>
            {isEntry && kind === 'pinned' && <button type="button" className="small" onClick={onEditNote}>{item.noteId ? 'Change note' : 'Attach note'}</button>}
            <button type="button" className="small" onClick={() => onChange(() => remove(worldId, item.id))}>{kind === 'featured' ? 'Unfeature' : 'Unpin'}</button>
          </div>
        )}
      </div>
    </li>
  );
}

export default function HighlightsWidget({worldId, featured, pinned, showFeatured, showPinned, canEdit, onChanged}) {
  const tabs = [];

  if (showFeatured) {
    tabs.push({key: 'featured', label: 'Featured', items: featured});
  }

  if (showPinned) {
    tabs.push({key: 'pinned', label: 'Pinned', items: pinned});
  }

  const [tab, setTab] = useState(tabs.length > 1 && featured.length === 0 && pinned.length > 0 ? 'pinned' : tabs[0].key);
  const [adding, setAdding] = useState(false);
  const [messageFor, setMessageFor] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [error, setError] = useState('');
  const [edges, setEdges] = useState({left: false, right: false});
  const scroller = useRef(null);
  const current = tabs.find((item) => item.key === tab) || tabs[0];
  const kind = current.key;
  const items = current.items;

  const measure = useCallback(() => {
    const el = scroller.current;

    if (el) {
      setEdges({left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4});
    }
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);

    return () => window.removeEventListener('resize', measure);
  }, [measure, items.length, kind]);

  function page(direction) {
    const el = scroller.current;
    const card = el.firstElementChild;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = card.offsetWidth + gap;
    const columns = Math.max(1, Math.round((el.clientWidth - 8) / step));

    el.scrollBy({left: direction * columns * step, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }

  async function change(action) {
    setError('');

    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAdd(data) {
    await (kind === 'featured' ? addFeaturedRequest(worldId, data) : addPinnedRequest(worldId, data));
    await onChanged();
  }

  async function handleSaveMessage(message) {
    await (kind === 'featured' ? changeFeaturedRequest(worldId, messageFor.id, {message}) : changePinnedRequest(worldId, messageFor.id, {message}));
    await onChanged();
  }

  function switchTab(key) {
    setTab(key);
    setAdding(false);
    setError('');
  }

  const noun = kind === 'featured' ? 'featured' : 'pinned';

  return (
    <section className="dash-section">
      <div className="dash-head">
        <h3>{current.label}</h3>

        {tabs.length > 1 && (
          <div className="segmented">
            {tabs.map((item) => <button key={item.key} type="button" aria-pressed={kind === item.key} onClick={() => switchTab(item.key)}>{item.label} ({item.items.length})</button>)}
          </div>
        )}
      </div>

      {items.length === 0 && <p className="muted">Nothing is {noun}</p>}

      {items.length > 0 && (
        <div className="spot-scroll">
          <button type="button" className="spot-arrow" aria-label="Scroll left" disabled={!edges.left} onClick={() => page(-1)}>&lsaquo;</button>

          <ul className="spot-grid" ref={scroller} tabIndex={0} aria-label={`${current.label} items`} onScroll={measure}>
            {items.map((item) => (
              <Card key={item.id} worldId={worldId} item={item} kind={kind} canEdit={canEdit} onChange={change} onEditNote={() => setNoteFor(item)} onEditMessage={() => setMessageFor(item)}/>
            ))}
          </ul>

          <button type="button" className="spot-arrow" aria-label="Scroll right" disabled={!edges.right} onClick={() => page(1)}>&rsaquo;</button>
        </div>
      )}

      {canEdit && (
        <div className="spot-add">
          <button type="button" className="small" disabled={items.length >= MAX[kind]} onClick={() => setAdding(true)}>{kind === 'featured' ? 'Add to Featured' : 'Add to Pinned'}</button>

          <span className="muted">{items.length} of {MAX[kind]}</span>
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      {adding && <AddHighlightModal worldId={worldId} kind={kind} items={items} onAdd={handleAdd} onClose={() => setAdding(false)}/>}

      {messageFor && <MessageModal title={`Message for ${itemName(messageFor)}`} message={messageFor.message} onSave={handleSaveMessage} onClose={() => setMessageFor(null)}/>}

      {noteFor && <PinnedNoteModal worldId={worldId} item={noteFor} onClose={() => setNoteFor(null)} onSave={(noteId) => change(() => changePinnedRequest(worldId, noteFor.id, {noteId}))}/>}
    </section>
  );
}
