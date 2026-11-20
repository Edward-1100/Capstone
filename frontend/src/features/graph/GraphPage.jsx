import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getGraphRequest } from '../../api/graph';
import { getWorldRequest } from '../../api/worlds';
import { loadSettings, saveSettings } from '../../utils/graph';
import GraphCanvas from './GraphCanvas';
import GraphControls from './GraphControls';
import NodeInfo from './NodeInfo';

export default function GraphPage() {
  const {id} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([getWorldRequest(id), getGraphRequest(id)])
      .then(([worldData, graphData]) => {
        setWorld(worldData);
        setData(graphData);
        setSettings(loadSettings(id, graphData, window.innerWidth <= 640));
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  function handleChange(next) {
    setSettings(next);
    saveSettings(id, next);
  }

  function handleSelect(nodeId) {
    setSelectedId(nodeId);

    if (nodeId && window.innerWidth <= 640 && settings.panel) {
      handleChange(Object.assign({}, settings, {panel: false}));
    }
  }

  const matchIds = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!data || !term) {
      return null;
    }

    return new Set(data.nodes.filter((node) => node.name.toLowerCase().includes(term)).map((node) => node.id));
  }, [data, search]);

  if (!world || !data || !settings) {
    return <div className="map-page"><p className="map-loading">Loading</p></div>;
  }

  const narrow = window.innerWidth <= 640;
  const hasInfo = selectedId !== null && data.nodes.some((node) => node.id === selectedId);
  const inset = {
    left: settings.panel && !narrow ? 376 : 0,
    right: hasInfo && !narrow ? 408 : 0,
    bottom: narrow && (settings.panel || hasInfo) ? Math.round(window.innerHeight * 0.6) : 0,
  };

  const pageClass = ['map-page', 'graph-page', settings.panel ? 'has-settings' : '', hasInfo ? 'has-info' : ''].join(' ').trim();

  return (
    <div className={pageClass}>
      <GraphCanvas data={data} settings={settings} selectedId={selectedId} matchIds={matchIds} inset={inset} onSelect={handleSelect}/>

      <div className="map-top graph-top">
        <header className="map-bar map-glass">
          <button type="button" aria-expanded={settings.panel} aria-controls="graph-settings" onClick={() => handleChange(Object.assign({}, settings, {panel: !settings.panel}))}>Graph settings</button>

          <Link to={`/worlds/${id}`}>{world.name}</Link>

          <input type="search" aria-label="Find an entry" placeholder="Find an entry" value={search} onChange={(e) => setSearch(e.target.value)}/>
        </header>
      </div>

      {data.truncated && <p className="map-notice map-glass" role="status">Showing the 3000 most recently updated entries</p>}

      {data.nodes.length === 0 && <p className="map-notice map-glass">No entries yet</p>}

      {hasInfo && <NodeInfo worldId={id} data={data} nodeId={selectedId} onSelect={handleSelect} onClose={() => setSelectedId(null)}/>}

      {settings.panel && <GraphControls id="graph-settings" data={data} settings={settings} onChange={handleChange}/>}
    </div>
  );
}
