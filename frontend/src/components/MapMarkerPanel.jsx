import { useEffect, useState } from 'react';
import { getEntryRequest } from '../api/entries';
import { deleteMarkerRequest, updateMarkerRequest } from '../api/maps';
import EntryView from './EntryView';
import MapPin from './MapPin';

export default function MapMarkerPanel({worldId, marker, mode, role, onChanged, onEntryChanged, onMove, onClose}) {
  const canEdit = role === 'owner' || role === 'editor';

  const [images, setImages] = useState([]);
  const [color, setColor] = useState(marker.color);
  const [innerColor, setInnerColor] = useState(marker.innerColor);
  const [imageScale, setImageScale] = useState(Math.max(1, marker.imageScale));
  const [imageX, setImageX] = useState(marker.imageX);
  const [imageY, setImageY] = useState(marker.imageY);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canEdit || mode !== 'menu') {
      return;
    }

    getEntryRequest(worldId, marker.entryId)
      .then((entry) => setImages(entry.images))
      .catch(() => setImages([]));
  }, [worldId, marker.entryId, canEdit, mode]);

  async function update(changes) {
    setError('');

    try {
      await updateMarkerRequest(worldId, marker.id, changes);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove() {
    setError('');

    try {
      await deleteMarkerRequest(worldId, marker.id);
      onClose();
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  const changed = color !== marker.color || innerColor !== marker.innerColor || imageScale !== marker.imageScale || imageX !== marker.imageX || imageY !== marker.imageY;

  function handleReset() {
    setColor(marker.color);
    setInnerColor(marker.innerColor);
    setImageScale(Math.max(1, marker.imageScale));
    setImageX(marker.imageX);
    setImageY(marker.imageY);
  }

  function handleSave() {
    update({color, innerColor, imageScale, imageX, imageY});
  }

  const info = mode === 'info' || !canEdit;

  if (info) {
    return (
      <div className="drawer-body">
        <EntryView worldId={worldId} entryId={marker.entryId} role={role} pageLink={`/worlds/${worldId}/entries/${marker.entryId}`} onChanged={onEntryChanged}/>
      </div>
    );
  }

  return (
    <div className="drawer-body pin-menu">
      <div className="pin-head">
        <MapPin color={color} innerColor={innerColor} imageUrl={marker.imageUrl} imageScale={imageScale} imageX={imageX} imageY={imageY} size={48}/>

        <h1 className="title">{marker.entryName}</h1>
      </div>

      <div className="pin-fields">
        <label className="pin-field" htmlFor={`pin-color-${marker.id}`}>
          <span>Pin color</span>
          <input id={`pin-color-${marker.id}`} type="color" value={color} onChange={(e) => setColor(e.target.value)}/>
        </label>

        <label className="pin-field" htmlFor={`pin-inner-${marker.id}`}>
          <span>Inside color</span>
          <input id={`pin-inner-${marker.id}`} type="color" value={innerColor} onChange={(e) => setInnerColor(e.target.value)}/>
        </label>

        {marker.imageUrl && (
          <>
            <label className="pin-field" htmlFor={`pin-scale-${marker.id}`}>
              <span>Image size</span>
              <input id={`pin-scale-${marker.id}`} type="range" min="1" max="4" step="0.05" value={imageScale} onChange={(e) => setImageScale(Number(e.target.value))}/>
            </label>

            <label className="pin-field" htmlFor={`pin-x-${marker.id}`}>
              <span>Image left and right</span>
              <input id={`pin-x-${marker.id}`} type="range" min="-1" max="1" step="0.05" value={imageX} onChange={(e) => setImageX(Number(e.target.value))}/>
            </label>

            <label className="pin-field" htmlFor={`pin-y-${marker.id}`}>
              <span>Image up and down</span>
              <input id={`pin-y-${marker.id}`} type="range" min="-1" max="1" step="0.05" value={imageY} onChange={(e) => setImageY(Number(e.target.value))}/>
            </label>
          </>
        )}

        {changed && <div className="actions"><button type="button" onClick={handleSave}>Save pin</button><button type="button" onClick={handleReset}>Undo</button></div>}
      </div>

      {images.length > 0 && (
        <div className="pin-images">
          {images.map((image, index) => (
            <button key={image.id} type="button" className={(marker.imageId ? marker.imageId === image.id : index === 0) ? 'on' : ''} aria-label={`Image ${index + 1}`} onClick={() => update({imageId: index === 0 ? null : image.id})}>
              <img src={image.url} alt=""/>
            </button>
          ))}
        </div>
      )}

      <div className="actions">
        <button type="button" onClick={onMove}>Move</button>

        {!confirmingRemove && <button type="button" className="danger" onClick={() => setConfirmingRemove(true)}>Remove from map</button>}

        {confirmingRemove && (
          <>
            <span>Remove this marker?</span>
            <button type="button" className="danger" onClick={handleRemove}>Yes, remove</button>
            <button type="button" onClick={() => setConfirmingRemove(false)}>Cancel</button>
          </>
        )}
      </div>

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
