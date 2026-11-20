import { useState } from 'react';

const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function WorldForm({initial, currentThumbnailUrl, submitLabel, onSubmit, onRemoveThumbnail, formId = undefined, hideSubmit = false}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const shownUrl = previewUrl || currentThumbnailUrl;

  function handleFileChange(event) {
    const chosen = event.target.files[0];

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setError('');

    if (!chosen) {
      setFile(null);
      setPreviewUrl('');

      return;
    }

    if (!ALLOWED_TYPES.includes(chosen.type)) {
      setError('Thumbnail must be a PNG, JPEG, or WebP image');
      setFile(null);
      setPreviewUrl('');
      event.target.value = '';

      return;
    }

    if (chosen.size > MAX_SIZE) {
      setError('Thumbnail must be 2 MB or smaller');
      setFile(null);
      setPreviewUrl('');
      event.target.value = '';

      return;
    }

    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
  }

  async function handleRemove() {
    setError('');

    try {
      await onRemoveThumbnail();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await onSubmit({name, description, visibility, file});
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form id={formId} className="world-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required/>
        </div>

        <div>
          <label htmlFor="visibility">Visibility</label>
          <select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div className="span">
          <label htmlFor="description">Description</label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000}/>
        </div>

        <div className="span">
          <label htmlFor="thumbnail">Thumbnail (PNG, JPEG, or WebP, up to 2 MB)</label>

          <div className="thumbnail-row">
            {shownUrl && <img className="preview" src={shownUrl} alt="Thumbnail"/>}

            <div>
              <input id="thumbnail" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange}/>

              {currentThumbnailUrl && !previewUrl && onRemoveThumbnail && <button type="button" onClick={handleRemove}>Remove thumbnail</button>}
            </div>
          </div>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}

      {!hideSubmit && <button type="submit" disabled={submitting}>{submitLabel}</button>}
    </form>
  );
}
