import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { previewImportRequest, runImportRequest } from '../../api/transfer';
import Modal from '../../components/Modal';
import TransferPicker from '../../components/TransferPicker';
import { CATEGORIES, countSelected, selectAll, stripImages, summarize } from '../../utils/transfer';

function emptyResolutions(clashes) {
  const result = {};

  for (const category of CATEGORIES) {
    result[category.key] = {};

    for (const ref of Object.keys(clashes[category.key] || {})) {
      result[category.key][ref] = {action: 'keep', name: ''};
    }
  }

  return result;
}

function Summary({result}) {
  const rows = [['Created', result.created], ['Replaced', result.replaced], ['Kept existing', result.kept], ['Skipped', result.skipped]];

  return (
    <div className="transfer-result">
      <ul className="plain">
        {rows.filter(([, counts]) => summarize(counts)).map(([label, counts]) => <li key={label}>{label}: {summarize(counts)}</li>)}
      </ul>

      {result.warnings.length > 0 && (
        <ul className="plain warnings">
          {result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function ImportModal({worldId = null, onClose}) {
  const id = worldId;
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selection, setSelection] = useState(null);
  const [resolutions, setResolutions] = useState(null);
  const [options, setOptions] = useState({images: false, comments: false, notes: false});
  const [details, setDetails] = useState({name: '', description: ''});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleFile(event) {
    const chosen = event.target.files[0];

    if (!chosen) {
      return;
    }

    setError('');
    setBusy(true);

    try {
      const doc = stripImages(JSON.parse(await chosen.text()));
      const data = await previewImportRequest(id, new Blob([JSON.stringify(doc)], {type: 'application/json'}));
      const clashes = Object.assign({relationships: {}}, data.clashes);

      setFile(chosen);
      setPreview(Object.assign({}, data, {clashes}));
      const all = selectAll(data.manifest);
      let room = data.mapCapacity.max - data.mapCapacity.used;

      all.maps = all.maps.filter((ref) => clashes.maps[ref] || room-- > 0);

      setSelection(all);
      setResolutions(emptyResolutions(clashes));
      setOptions({images: data.totals.images > 0 || data.totals.thumbnail, comments: data.totals.comments > 0, notes: data.totals.notes > 0});
      setDetails({name: data.world.name, description: data.world.description});
    } catch (err) {
      setError(err instanceof SyntaxError ? 'This file is not valid JSON' : err.message);
      event.target.value = '';
    } finally {
      setBusy(false);
    }
  }

  function handleResolve(category, ref, value) {
    setResolutions(Object.assign({}, resolutions, {[category]: Object.assign({}, resolutions[category], {[ref]: value})}));
  }

  function handleReset() {
    setFile(null);
    setPreview(null);
    setSelection(null);
    setResult(null);
    setError('');
  }

  async function handleImport() {
    setError('');
    setBusy(true);

    try {
      const plan = {world: details, options, select: selection, resolutions};

      setResult(await runImportRequest(id, file, plan));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const title = id ? 'Import into this world' : 'Import world';

  if (result) {
    const footer = (
      <>
        <button type="button" onClick={onClose}>Close</button>
        <button type="button" className="primary" onClick={() => navigate(`/worlds/${result.worldId}`)}>Open world</button>
      </>
    );

    return (
      <Modal title="Import finished" size="small" onClose={onClose} footer={footer}>
        <Summary result={result}/>
      </Modal>
    );
  }

  if (!preview) {
    return (
      <Modal title={title} size="small" onClose={busy ? undefined : onClose} footer={<button type="button" disabled={busy} onClick={onClose}>Cancel</button>}>
        <label>
          <input type="file" accept=".json,application/json" disabled={busy} onChange={handleFile}/>
        </label>

        {busy && <p>Reading file</p>}

        {error && <p role="alert">{error}</p>}
      </Modal>
    );
  }

  const free = preview.mapCapacity.max - preview.mapCapacity.used;
  const creating = selection.maps.filter((ref) => !preview.clashes.maps[ref] || resolutions.maps[ref].action === 'rename').length;
  const named = id ? true : details.name.trim().length > 0;

  const footer = (
    <>
      <button type="button" disabled={busy} onClick={handleReset}>Choose another file</button>
      <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button type="button" className="primary" disabled={busy || !named || countSelected(selection) === 0} onClick={handleImport}>{busy ? 'Importing' : 'Import'}</button>
    </>
  );

  return (
    <Modal title={title} size="small" onClose={busy ? undefined : onClose} footer={footer}>
      {preview.exportedBy && <p className="muted">From {preview.world.name}, exported by {preview.exportedBy}</p>}

      {!id && (
        <div className="transfer-world">
          <label>
            World name
            <input type="text" maxLength={100} value={details.name} onChange={(event) => setDetails(Object.assign({}, details, {name: event.target.value}))}/>
          </label>

          <label>
            Description
            <textarea maxLength={5000} value={details.description} onChange={(event) => setDetails(Object.assign({}, details, {description: event.target.value}))}/>
          </label>
        </div>
      )}

      <div className="transfer-options">
        <label>
          <input type="checkbox" checked={options.images} disabled={preview.totals.images === 0 && !preview.totals.thumbnail} onChange={(event) => setOptions(Object.assign({}, options, {images: event.target.checked}))}/>
          Images
          <span className="muted">{preview.totals.images}</span>
        </label>

        <label>
          <input type="checkbox" checked={options.comments} disabled={preview.totals.comments === 0} onChange={(event) => setOptions(Object.assign({}, options, {comments: event.target.checked}))}/>
          Comments
          <span className="muted">{preview.totals.comments}</span>
        </label>

        <label>
          <input type="checkbox" checked={options.notes} disabled={preview.totals.notes === 0} onChange={(event) => setOptions(Object.assign({}, options, {notes: event.target.checked}))}/>
          Notes
          <span className="muted">{preview.totals.notes}</span>
        </label>
      </div>

      <TransferPicker manifest={preview.manifest} selection={selection} onChange={setSelection} clashes={preview.clashes} resolutions={resolutions} onResolve={handleResolve} mapSlots={{free, creating}}/>

      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
