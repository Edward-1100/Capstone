import { useState } from 'react';
import { getEntryRequest } from '../../../api/entries';
import { listEntryRelationshipsRequest } from '../../../api/relationships';
import EntryPicker from '../../../components/EntryPicker';
import Modal from '../../../components/Modal';
import { formatValue } from '../../../utils/fields';
import LayoutSelect from './LayoutSelect';

const DETAIL_SPACES = 3;

function spaces(field) {
  return field.fieldType === 'long_text' ? 2 : 1;
}

function clip(text) {
  return text.length > 60 ? text.slice(0, 60) : text;
}

function relationshipLabel(entryName, link) {
  const names = link.direction === 'out' ? `${entryName} --> ${link.otherName}` : `${link.otherName} --> ${entryName}`;

  return `${names} (${link.typeName})`;
}

export default function AddHighlightModal({worldId, kind, items, onAdd, onClose}) {
  const [mode, setMode] = useState('entry');
  const [layout, setLayout] = useState('image');
  const [message, setMessage] = useState('');
  const [entry, setEntry] = useState(null);
  const [links, setLinks] = useState([]);
  const [relationshipId, setRelationshipId] = useState('');
  const [fieldIds, setFieldIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const exclude = mode === 'relationship' ? [] : items.filter((item) => item.kind === mode).map((item) => item.entryId);
  const usedLinks = items.filter((item) => item.kind === 'relationship').map((item) => item.relationshipId);
  const choices = links.filter((link) => !usedLinks.includes(link.id));
  const fields = entry ? entry.typeFields.filter((field) => formatValue(field, entry.fields[field.id]) !== '') : [];
  const used = fields.filter((field) => fieldIds.includes(field.id)).reduce((total, field) => total + spaces(field), 0);

  function isReady() {
    if (mode === 'entry') {
      return entry !== null;
    }

    if (mode === 'relationship') {
      return relationshipId !== '';
    }

    return fieldIds.length > 0;
  }

  async function handlePick(entryId) {
    setError('');
    setRelationshipId('');
    setFieldIds([]);

    try {
      const loaded = await Promise.all([getEntryRequest(worldId, entryId), listEntryRelationshipsRequest(worldId, entryId)]);

      setEntry(loaded[0]);
      setLinks(loaded[1]);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleClear() {
    setEntry(null);
    setLinks([]);
    setRelationshipId('');
    setFieldIds([]);
  }

  function toggleField(fieldId) {
    setFieldIds(fieldIds.includes(fieldId) ? fieldIds.filter((item) => item !== fieldId) : fieldIds.concat([fieldId]));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const data = {kind: mode, message};

    if (mode === 'entry') {
      data.entryId = entry.id;
      data.layout = layout;
    }

    if (mode === 'relationship') {
      data.relationshipId = relationshipId;
    }

    if (mode === 'details') {
      data.entryId = entry.id;
      data.fieldIds = fieldIds;
    }

    setError('');
    setBusy(true);

    try {
      await onAdd(data);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const footer = (
    <>
      <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button type="submit" form="highlight-add-form" className="primary" disabled={busy || !isReady()}>Add</button>
    </>
  );

  return (
    <Modal title={kind === 'featured' ? 'Add to Featured' : 'Add to Pinned'} onClose={busy ? undefined : onClose} footer={footer}>
      <form id="highlight-add-form" className="suggest-form" onSubmit={handleSubmit}>
        <label>
          Show
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="entry">An entry</option>
            <option value="relationship">A relationship</option>
            <option value="details">Details of an entry</option>
          </select>
        </label>

        <div>
          <span className="label">Entry</span>

          {entry && (
            <p className="line">
              <span>{entry.name}</span>
              <button type="button" className="small" onClick={handleClear}>Change</button>
            </p>
          )}

          {!entry && <EntryPicker worldId={worldId} exclude={exclude} onPick={handlePick} placeholder="Find an entry" label="Entry"/>}
        </div>

        {entry && mode === 'entry' && <LayoutSelect kind={kind} value={layout} onChange={setLayout}/>}

        {entry && mode === 'relationship' && (
          <label>
            Relationship
            <select value={relationshipId} onChange={(event) => setRelationshipId(event.target.value)}>
              <option value="">Choose a relationship</option>
              {choices.map((link) => <option key={link.id} value={link.id}>{relationshipLabel(entry.name, link)}</option>)}
            </select>
          </label>
        )}

        {entry && mode === 'details' && (
          <div>
            <span className="label">Details ({used} of {DETAIL_SPACES})</span>

            {fields.length === 0 && <p className="muted">This entry has no details</p>}

            {fields.map((field) => (
              <label key={field.id} className="check">
                <input type="checkbox" checked={fieldIds.includes(field.id)} disabled={!fieldIds.includes(field.id) && used + spaces(field) > DETAIL_SPACES} onChange={() => toggleField(field.id)}/>
                {field.name}: {clip(formatValue(field, entry.fields[field.id]))}
              </label>
            ))}
          </div>
        )}

        <label>
          Message (optional)
          <textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)}/>
        </label>

        {error && <p role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
