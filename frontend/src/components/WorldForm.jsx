import { useState } from 'react';

export default function WorldForm({initial, submitLabel, onSubmit}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(event) {
    const file = event.target.files[0];

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(file ? URL.createObjectURL(file) : '');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await onSubmit({name, description, visibility});
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required/>
      </div>

      <div>
        <label htmlFor="description">Description</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000}/>
      </div>

      <div>
        <label htmlFor="visibility">Visibility</label>
        <select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </div>

      <div>
        <label htmlFor="thumbnail">Thumbnail</label>
        <input id="thumbnail" type="file" accept="image/*" onChange={handleFileChange}/>
        {previewUrl && <img src={previewUrl} alt="Thumbnail preview" width="200"/>}
        <p>Thumbnails are not yet set up</p>
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={submitting}>{submitLabel}</button>
    </form>
  );
}
