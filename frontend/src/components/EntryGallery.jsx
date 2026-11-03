import { useRef, useState } from 'react';
import { addEntryImageRequest, deleteEntryImageRequest, replaceEntryImageRequest } from '../api/entries';

const MAX_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function checkFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Image must be a PNG, JPEG, or WebP image';
  }

  if (file.size > MAX_SIZE) {
    return 'Image must be 5 MB or smaller';
  }

  return '';
}

export default function EntryGallery({worldId, entryId, entryName, images, canEdit, onChange}) {
  const addInput = useRef(null);
  const replaceInput = useRef(null);

  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');

  const count = images.length;
  const current = count === 0 ? 0 : Math.min(index, count - 1);
  const previous = (current - 1 + count) % count;
  const next = (current + 1) % count;

  function go(position) {
    setIndex((position + count) % count);
  }

  function handleKeyDown(event) {
    if (count < 2) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      go(current - 1);
    }

    if (event.key === 'ArrowRight') {
      go(current + 1);
    }
  }

  async function upload(event, send) {
    const file = event.target.files[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    const problem = checkFile(file);

    if (problem) {
      setError(problem);

      return;
    }

    setError('');

    try {
      onChange(await send(file));
    } catch (err) {
      setError(err.message);
    }
  }

  function handleAdd(event) {
    return upload(event, (file) => addEntryImageRequest(worldId, entryId, file));
  }

  function handleReplace(event) {
    return upload(event, (file) => replaceEntryImageRequest(worldId, entryId, images[current].id, file));
  }

  async function handleRemove() {
    setError('');

    try {
      onChange(await deleteEntryImageRequest(worldId, entryId, images[current].id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (count === 0 && !canEdit) {
    return null;
  }

  return (
    <div>
      {count === 0 && <p className="muted">No images yet</p>}

      {count > 0 && (
        <div className="gallery" tabIndex={0} onKeyDown={handleKeyDown} aria-label="Images">
          {count > 1 && <button type="button" aria-label="Previous image" onClick={() => go(current - 1)}>&lsaquo;</button>}

          <div className="track">
            {count > 2 ? <button type="button" className="slide side left" aria-label="Previous image" onClick={() => go(previous)}><img src={images[previous].url} alt=""/></button> : <span className="slide side left empty"></span>}

            <div className="slide center"><img src={images[current].url} alt={`${entryName}, image ${current + 1}`}/></div>

            {count > 1 ? <button type="button" className="slide side right" aria-label="Next image" onClick={() => go(next)}><img src={images[next].url} alt=""/></button> : <span className="slide side right empty"></span>}
          </div>

          {count > 1 && <button type="button" aria-label="Next image" onClick={() => go(current + 1)}>&rsaquo;</button>}
        </div>
      )}

      <div className="gallery-actions">
        {count > 0 && <span>Image {current + 1} of {count}</span>}

        {canEdit && count < MAX_IMAGES && <button type="button" onClick={() => addInput.current.click()}>Add image</button>}
        {canEdit && count > 0 && <button type="button" onClick={() => replaceInput.current.click()}>Replace</button>}
        {canEdit && count > 0 && <button type="button" className="danger" onClick={handleRemove}>Remove</button>}
      </div>

      <input ref={addInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={handleAdd}/>
      <input ref={replaceInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={handleReplace}/>

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
