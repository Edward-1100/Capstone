import { useEffect, useState } from 'react';
import { exportWorldRequest, getExportManifestRequest } from '../../api/transfer';
import Modal from '../../components/Modal';
import TransferPicker from '../../components/TransferPicker';
import { countSelected, selectAll } from '../../utils/transfer';

export default function ExportModal({worldId, onClose}) {
  const [data, setData] = useState(null);
  const [selection, setSelection] = useState(null);
  const [options, setOptions] = useState({images: false, comments: false, notes: false});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getExportManifestRequest(worldId)
      .then((result) => {
        setData(result);
        setSelection(selectAll(result.manifest));
        setOptions({images: result.totals.images > 0 || result.totals.thumbnail, comments: result.totals.comments > 0, notes: result.totals.notes > 0});
      })
      .catch((err) => setError(err.message));
  }, [worldId]);

  async function handleExport() {
    setError('');
    setBusy(true);

    try {
      const {blob, filename} = await exportWorldRequest(worldId, selection, options);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const footer = (
    <>
      <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button type="button" className="primary" disabled={busy || !selection || countSelected(selection) === 0} onClick={handleExport}>{busy ? 'Exporting' : 'Export'}</button>
    </>
  );

  if (!data || !selection) {
    return (
      <Modal title="Export world" size="small" onClose={onClose} footer={<button type="button" onClick={onClose}>Close</button>}>
        {error ? <p role="alert">{error}</p> : <p>Loading</p>}
      </Modal>
    );
  }

  const imageCount = data.totals.images + (data.totals.thumbnail ? 1 : 0);

  return (
    <Modal title="Export world" size="small" onClose={busy ? undefined : onClose} footer={footer}>
      <div className="transfer-options">
        <label>
          <input type="checkbox" checked={options.images} disabled={imageCount === 0} onChange={(event) => setOptions(Object.assign({}, options, {images: event.target.checked}))}/>
          Images
          <span className="muted">{imageCount}</span>
        </label>

        <label>
          <input type="checkbox" checked={options.comments} disabled={data.totals.comments === 0} onChange={(event) => setOptions(Object.assign({}, options, {comments: event.target.checked}))}/>
          Comments
          <span className="muted">{data.totals.comments}</span>
        </label>

        <label>
          <input type="checkbox" checked={options.notes} disabled={data.totals.notes === 0} onChange={(event) => setOptions(Object.assign({}, options, {notes: event.target.checked}))}/>
          Notes
          <span className="muted">{data.totals.notes}</span>
        </label>
      </div>

      <TransferPicker manifest={data.manifest} selection={selection} onChange={setSelection}/>

      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
