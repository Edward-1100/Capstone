import { useEffect, useState } from 'react';
import { getDashboardSettingsRequest, saveDashboardSettingsRequest } from '../../api/dashboard';

const AUDIENCES = {
  all: 'Everyone',
  editor: 'Editors and owner',
  owner: 'Owner only',
};

const WIDGETS = [
  {key: 'announcement', label: 'Announcement', audiences: ['all', 'editor', 'owner']},
  {key: 'entries', label: 'Entries by type', audiences: ['all', 'editor', 'owner']},
  {key: 'attention', label: 'Needs attention', audiences: ['all', 'editor', 'owner']},
  {key: 'featured', label: 'Featured', audiences: ['all', 'editor', 'owner']},
  {key: 'pinned', label: 'Pinned', audiences: ['editor', 'owner']},
  {key: 'activity', label: 'Recent activity', audiences: ['all', 'editor', 'owner']},
];

export default function DashboardSettings({id}) {
  const [settings, setSettings] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDashboardSettingsRequest(id)
      .then((data) => {
        setSettings(data.settings);
        setAnnouncement(data.announcement);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  function change(updater) {
    setSaved(false);
    setSettings(updater(settings));
  }

  function setWidget(key, changes) {
    change((current) => Object.assign({}, current, {[key]: Object.assign({}, current[key], changes)}));
  }

  function handleAnnouncementChange(event) {
    setSaved(false);
    setAnnouncement(event.target.value);
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const data = await saveDashboardSettingsRequest(id, settings, announcement);

      setSettings(data.settings);
      setAnnouncement(data.announcement);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Dashboard</h2>

      {!settings && !error && <p>Loading</p>}

      {settings && (
        <form onSubmit={handleSave}>
          <div>
            <label htmlFor="announcement">Announcement</label>
            <textarea id="announcement" value={announcement} maxLength={1000} onChange={handleAnnouncementChange}/>
          </div>

          <div className="setting-rows">
            {WIDGETS.map((widget) => (
              <div className="setting-row" key={widget.key}>
                <span>{widget.label}</span>

                <label>
                  <input type="checkbox" checked={settings[widget.key].shown} onChange={(event) => setWidget(widget.key, {shown: event.target.checked})}/>
                  Show
                </label>

                <select aria-label={`Who sees ${widget.label}`} value={settings[widget.key].visibleTo} disabled={!settings[widget.key].shown} onChange={(event) => setWidget(widget.key, {visibleTo: event.target.value})}>
                  {widget.audiences.map((audience) => <option key={audience} value={audience}>{AUDIENCES[audience]}</option>)}
                </select>
              </div>
            ))}

            <div className="setting-row">
              <span>Suggestion box, who can send</span>

              <span/>

              <select aria-label="Who can send suggestions" value={settings.suggestions.submit} onChange={(event) => setWidget('suggestions', {submit: event.target.value})}>
                <option value="viewer">Everyone who can view</option>
                <option value="editor">Editors and owner</option>
                <option value="none">No one</option>
              </select>
            </div>

            <div className="setting-row">
              <span>Suggestion box, who can read</span>

              <span/>

              <select aria-label="Who can read suggestions" value={settings.suggestions.see} onChange={(event) => setWidget('suggestions', {see: event.target.value})}>
                <option value="editor">Editors and owner</option>
                <option value="owner">Owner only</option>
              </select>
            </div>
          </div>

          {error && <p role="alert">{error}</p>}

          <div className="line">
            <button type="submit" disabled={busy}>{busy ? 'Saving' : 'Save dashboard'}</button>

            {saved && <span role="status">Saved</span>}
          </div>
        </form>
      )}

      {!settings && error && <p role="alert">{error}</p>}
    </section>
  );
}
