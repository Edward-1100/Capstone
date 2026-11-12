import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listEntriesRequest } from '../../api/entries';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { createMarkerRequest, getMapRequest, listMapsRequest, updateMarkerRequest } from '../../api/maps';
import { getWorldRequest } from '../../api/worlds';
import MapManager from '../../components/MapManager';
import MapMarkerPanel from '../../components/MapMarkerPanel';
import MapSettings from '../../components/MapSettings';
import MapViewport from '../../components/MapViewport';
import Typeahead from '../../components/Typeahead';

function readLastMap(worldId) {
  try {
    return localStorage.getItem(`map:${worldId}`);
  } catch {
    return null;
  }
}

function saveLastMap(worldId, mapId) {
  try {
    localStorage.setItem(`map:${worldId}`, mapId);
  } catch {
    return;
  }
}

export default function MapPage() {
  const {id, mapId} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [list, setList] = useState(null);
  const [map, setMap] = useState(null);
  const [entries, setEntries] = useState([]);
  const [types, setTypes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [placing, setPlacing] = useState(null);
  const [markerMode, setMarkerMode] = useState('info');
  const [drawer, setDrawer] = useState('');
  const [error, setError] = useState('');

  const canEdit = world ? world.role === 'owner' || world.role === 'editor' : false;

  useEffect(() => {
    Promise.all([getWorldRequest(id), listMapsRequest(id), listEntriesRequest(id), listEntryTypesRequest(id)])
      .then(([worldData, listData, entryData, typeData]) => {
        setWorld(worldData);
        setList(listData);
        setEntries(entryData);
        setTypes(typeData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  useEffect(() => {
    if (!list || mapId || list.maps.length === 0) {
      return;
    }

    const last = readLastMap(id);
    const target = list.maps.find((item) => item.id === last) || list.maps[0];

    navigate(`/worlds/${id}/maps/${target.id}`, {replace: true});
  }, [list, mapId, id, navigate]);

  useEffect(() => {
    if (!mapId) {
      return;
    }

    getMapRequest(id, mapId)
      .then((data) => {
        setMap(data);
        saveLastMap(id, mapId);
      })
      .catch((err) => {
        if (err.status === 404) {
          navigate(`/worlds/${id}/maps`, {replace: true});
        } else {
          setError(err.message);
        }
      });
  }, [id, mapId, navigate]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== 'Escape') {
        return;
      }

      setPlacing(null);
      setSelectedId(null);
      setDrawer('');
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    function handleFocus() {
      listEntriesRequest(id).then(setEntries).catch(() => undefined);
    }

    window.addEventListener('focus', handleFocus);

    return () => window.removeEventListener('focus', handleFocus);
  }, [id]);

  async function reloadMap() {
    const data = await getMapRequest(id, mapId);

    setMap((previous) => (previous && previous.id === data.id ? Object.assign({}, data, {imageUrl: previous.imageUrl}) : data));
  }

  async function reloadList() {
    setList(await listMapsRequest(id));
  }

  async function reloadEntries() {
    setEntries(await listEntriesRequest(id));
  }

  async function reloadTypes() {
    const typeData = await listEntryTypesRequest(id);

    setTypes(typeData);
    await reloadMap();
  }

  async function handleMarkerChanged() {
    await reloadMap();
    await reloadEntries();
  }

  function refreshEntries() {
    reloadEntries().catch(() => undefined);
  }

  async function handleEntryChanged() {
    await reloadMap();
    await reloadEntries();
  }

  function goTo(nextId) {
    setSelectedId(null);
    setPlacing(null);
    navigate(`/worlds/${id}/maps/${nextId}`);
  }

  function handleOpenFromManager(nextId) {
    setDrawer('');
    goTo(nextId);
  }

  async function handleMapsChanged(deletedId) {
    await reloadList();

    if (deletedId && deletedId === mapId) {
      setMap(null);
      setDrawer('');
      navigate(`/worlds/${id}/maps`, {replace: true});
    } else {
      await reloadMap();
    }
  }

  async function handleMapCreated(created) {
    await reloadList();
    setDrawer('');
    goTo(created.id);
  }

  function handlePick(entryId) {
    const entry = entries.find((item) => item.id === entryId);

    setSelectedId(null);
    setDrawer('');
    setPlacing({entryId, name: entry.name});
  }

  function handleMove(marker) {
    setPlacing({markerId: marker.id, name: marker.entryName});
  }

  function handleSelect(markerId) {
    if (placing) {
      return;
    }

    setDrawer('');

    if (markerId !== selectedId) {
      setSelectedId(markerId);
      setMarkerMode('info');
    } else if (canEdit) {
      setMarkerMode(markerMode === 'info' ? 'menu' : 'info');
    }
  }

  async function handleMoveMarker(markerId, x, y) {
    setError('');
    setMap((previous) => (previous ? Object.assign({}, previous, {markers: previous.markers.map((marker) => (marker.id === markerId ? Object.assign({}, marker, {x, y}) : marker))}) : previous));

    try {
      await updateMarkerRequest(id, markerId, {x, y});
    } catch (err) {
      setError(err.message);
      await reloadMap();
    }
  }

  function handleBackground() {
    setSelectedId(null);
  }

  async function handlePlace(x, y) {
    setError('');

    try {
      if (placing.markerId) {
        await updateMarkerRequest(id, placing.markerId, {x, y});
        setSelectedId(placing.markerId);
      } else {
        const marker = await createMarkerRequest(id, mapId, {entryId: placing.entryId, x, y});

        setSelectedId(marker.id);
      }

      if (!placing.markerId) {
        setPlacing(null);
      }

      await reloadMap();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleDrawer(name) {
    setSelectedId(null);
    setPlacing(null);
    setDrawer(drawer === name ? '' : name);
  }

  if (!world || !list) {
    return <div className="map-page"><p className="map-loading">Loading</p></div>;
  }

  const current = map && map.id === mapId ? map : null;
  const selected = current ? current.markers.find((marker) => marker.id === selectedId) : null;
  const mappableTypeIds = types.filter((type) => type.mappable).map((type) => type.id);
  const placedIds = current ? current.markers.map((marker) => marker.entryId) : [];
  const options = entries
    .filter((entry) => entry.typeId && mappableTypeIds.includes(entry.typeId) && !placedIds.includes(entry.id))
    .map((entry) => ({id: entry.id, label: entry.name, count: entry.relationshipCount}));

  return (
    <div className="map-page">
      {current && <MapViewport key={current.id} imageUrl={current.imageUrl} name={current.name} markers={current.markers} selectedId={selectedId} placing={placing} canEdit={canEdit} onSelect={handleSelect} onMoveMarker={handleMoveMarker} onPlace={handlePlace} onBackground={handleBackground}/>}

      <div className={selected || drawer ? 'map-top shifted' : 'map-top'}>
        <header className="map-bar map-glass">
          <Link to={`/worlds/${id}`}>{world.name}</Link>

          {list.maps.length > 0 && (
            <select aria-label="Map" value={mapId || ''} onChange={(e) => goTo(e.target.value)}>
              {list.maps.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}

          {canEdit && current && <Typeahead options={options} onPick={handlePick} onOpen={refreshEntries} showCount={false} placeholder="Add an entry" label="Add an entry to the map"/>}

          {canEdit && list.maps.length > 0 && <button type="button" onClick={() => toggleDrawer('maps')}>Maps</button>}

          {canEdit && <button type="button" onClick={() => toggleDrawer('settings')}>Settings</button>}
        </header>

        {placing && (
          <div className="map-placing map-glass">
            <span>{placing.markerId ? `Click the map or drag the pin to move ${placing.name}` : `Click the map to place ${placing.name}`}</span>

            <button type="button" onClick={() => setPlacing(null)}>Cancel</button>
          </div>
        )}
      </div>

      {error && <p className="map-notice map-glass" role="alert">{error}</p>}

      {list.maps.length === 0 && (
        <div className="map-empty map-glass">
          {canEdit ? <MapManager worldId={id} list={list} currentId={null} canEdit={canEdit} onOpen={handleOpenFromManager} onChanged={handleMapsChanged} onCreated={handleMapCreated}/> : <p>No maps yet</p>}
        </div>
      )}

      {selected && (
        <aside className="map-drawer map-glass">
          <div className="drawer-scroll">
            <MapMarkerPanel key={selected.id} worldId={id} marker={selected} onEntryChanged={handleEntryChanged} mode={markerMode} role={world.role} onChanged={handleMarkerChanged} onMove={() => handleMove(selected)} onClose={() => setSelectedId(null)}/>
          </div>
        </aside>
      )}

      {!selected && drawer === 'maps' && list.maps.length > 0 && (
        <aside className="map-drawer map-glass">
          <div className="drawer-scroll">
            <MapManager worldId={id} list={list} currentId={mapId} canEdit={canEdit} onOpen={handleOpenFromManager} onChanged={handleMapsChanged} onCreated={handleMapCreated} onClose={() => setDrawer('')}/>
          </div>
        </aside>
      )}

      {!selected && drawer === 'settings' && (
        <aside className="map-drawer map-glass">
          <div className="drawer-scroll">
            <MapSettings worldId={id} types={types} onChanged={reloadTypes} onClose={() => setDrawer('')}/>
          </div>
        </aside>
      )}
    </div>
  );
}
