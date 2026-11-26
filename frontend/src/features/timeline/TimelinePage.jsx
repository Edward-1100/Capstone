import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listEntriesRequest } from '../../api/entries';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { listTimelineRequest } from '../../api/timeline';
import { getWorldRequest } from '../../api/worlds';
import TimelineAddPanel from '../../components/TimelineAddPanel';
import TimelineItemPanel from '../../components/TimelineItemPanel';
import TimelineSettings from '../../components/TimelineSettings';
import { AXIS_HEIGHT, MAX_PIXELS_PER_MINUTE, ROW_HEIGHT, clampStart, clipPlace, fitView, layoutItems, tickMarks } from '../../utils/timeline';

const ZOOM_STEP = 2;
const TOP_SPACE = 76;

export default function TimelinePage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const viewRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const wheelRef = useRef(null);

  const [world, setWorld] = useState(null);
  const [items, setItems] = useState(null);
  const [entries, setEntries] = useState([]);
  const [types, setTypes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [drawer, setDrawer] = useState('');
  const [custom, setCustom] = useState(null);
  const [width, setWidth] = useState(900);

  const canEdit = world ? world.role === 'owner' || world.role === 'editor' : false;

  useEffect(() => {
    Promise.all([getWorldRequest(id), listTimelineRequest(id), listEntriesRequest(id), listEntryTypesRequest(id)])
      .then(([worldData, itemData, entryData, typeData]) => {
        setWorld(worldData);
        setItems(itemData);
        setEntries(entryData);
        setTypes(typeData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  useEffect(() => {
    function measure() {
      if (viewRef.current) {
        setWidth(viewRef.current.clientWidth);
      }
    }

    measure();
    window.addEventListener('resize', measure);

    return () => window.removeEventListener('resize', measure);
  }, [items]);

  const ready = items !== null;

  useEffect(() => {
    const stage = viewRef.current;

    if (!stage) {
      return undefined;
    }

    function handleWheel(event) {
      event.preventDefault();

      if (wheelRef.current) {
        wheelRef.current(event, stage.getBoundingClientRect());
      }
    }

    stage.addEventListener('wheel', handleWheel, {passive: false});

    return () => stage.removeEventListener('wheel', handleWheel);
  }, [ready]);

  async function reloadItems() {
    setItems(await listTimelineRequest(id));
  }

  async function handleTypesChanged() {
    const [typeData, itemData] = await Promise.all([listEntryTypesRequest(id), listTimelineRequest(id)]);

    setTypes(typeData);
    setItems(itemData);
  }

  async function handleAdded(created) {
    setDrawer('');
    setSelectedId(created.id);
    await reloadItems();
  }

  function toggleDrawer(name) {
    setSelectedId(null);
    setDrawer(drawer === name ? '' : name);

    if (name === 'add') {
      listEntriesRequest(id).then(setEntries).catch(() => undefined);
    }
  }

  async function handleRemoved() {
    setSelectedId(null);
    await reloadItems();
  }

  if (!world || !items) {
    return <div className="map-page"><p className="map-notice map-glass">Loading</p></div>;
  }

  const fit = fitView(items, width);
  const view = custom || fit;

  function zoomTo(nextPpm) {
    const center = view.start + width / 2 / view.ppm;
    const ppm = Math.min(Math.max(nextPpm, fit.ppm), MAX_PIXELS_PER_MINUTE);

    if (ppm <= fit.ppm) {
      setCustom(null);

      return;
    }

    setCustom({start: clampStart(center - width / 2 / ppm, ppm, fit, width), ppm});
  }

  function panBy(amount) {
    if (custom) {
      setCustom({start: clampStart(custom.start + amount, custom.ppm, fit, width), ppm: custom.ppm});
    }
  }

  function handleWheel(event, rect) {
    const scale = event.deltaMode === 1 ? 16 : 1;
    const deltaY = event.deltaY * scale;
    const deltaX = event.deltaX * scale;
    const wheelLike = event.deltaMode === 1 || (Math.abs(deltaY) >= 50 && Number.isInteger(deltaY) && deltaX === 0);

    if (event.ctrlKey || (wheelLike && !event.shiftKey)) {
      const factor = Math.exp(-deltaY * (event.ctrlKey ? 0.01 : 0.0015));
      const x = event.clientX - rect.left;
      const ppm = Math.min(Math.max(view.ppm * factor, fit.ppm), MAX_PIXELS_PER_MINUTE);

      if (ppm <= fit.ppm) {
        setCustom(null);

        return;
      }

      const at = view.start + x / view.ppm;

      setCustom({start: clampStart(at - x / ppm, ppm, fit, width), ppm});

      return;
    }

    panBy((event.shiftKey ? deltaY + deltaX : deltaX + deltaY) / view.ppm);
  }

  wheelRef.current = handleWheel;

  function handlePointerDown(event) {
    movedRef.current = false;

    if (custom) {
      dragRef.current = {x: event.clientX, start: custom.start};
    }
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;

    if (!drag || !custom) {
      return;
    }

    const moved = event.clientX - drag.x;

    if (Math.abs(moved) > 4) {
      movedRef.current = true;
    }

    if (movedRef.current) {
      setCustom({start: clampStart(drag.start - moved / custom.ppm, custom.ppm, fit, width), ppm: custom.ppm});
    }
  }

  function handlePointerEnd() {
    dragRef.current = null;
  }

  function handleSelect(itemId) {
    if (movedRef.current) {
      movedRef.current = false;

      return;
    }

    setDrawer('');
    setSelectedId(itemId);
  }

  const layout = layoutItems(items, view);
  const ticks = tickMarks(view.start, view.start + width / view.ppm, view.ppm);
  const selected = items.find((item) => item.id === selectedId);
  const open = Boolean(selected) || drawer !== '';

  return (
    <div className="map-page timeline-page">
      <div className={custom ? 'timeline-stage pannable' : 'timeline-stage'} ref={viewRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerLeave={handlePointerEnd}>
        <div className="timeline-view" style={{height: Math.max(TOP_SPACE + AXIS_HEIGHT + layout.lanes * ROW_HEIGHT + 80, 0)}}>
          {ticks.map((mark) => (
            <span key={mark.at} className="timeline-tick" style={{left: (mark.at - view.start) * view.ppm}}>{mark.label}</span>
          ))}

          {layout.placed.map((place) => {
            const clipped = clipPlace(place, width);

            if (!clipped) {
              return null;
            }

            return (
              <button key={place.item.id} type="button" className={place.item.id === selectedId ? 'timeline-item selected' : 'timeline-item'} style={{left: clipped.left, top: TOP_SPACE + AXIS_HEIGHT + place.lane * ROW_HEIGHT, width: clipped.width, '--item-color': place.item.color || undefined}} onClick={() => handleSelect(place.item.id)}>
                <span className="timeline-name">{place.item.entryName}</span>

                <span className="timeline-bar" style={{width: clipped.barWidth}}/>
              </button>
            );
          })}
        </div>
      </div>

      <div className={open ? 'map-top shifted' : 'map-top'}>
        <header className="map-bar map-glass">
          <Link to={`/worlds/${id}`}>{world.name}</Link>

          <strong>Timeline</strong>

          {canEdit && <button type="button" className="primary" onClick={() => toggleDrawer('add')}>Add entry</button>}

          {canEdit && <button type="button" onClick={() => toggleDrawer('settings')}>Settings</button>}
        </header>
      </div>

      {items.length === 0 && drawer !== 'add' && <p className="map-notice map-glass">{canEdit ? 'Nothing on the timeline yet, use Add entry to place the first one' : 'Nothing on the timeline yet'}</p>}

      {items.length > 0 && (
        <div className="map-zoom map-glass">
          <button type="button" onClick={() => zoomTo(view.ppm * ZOOM_STEP)} disabled={view.ppm >= MAX_PIXELS_PER_MINUTE} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomTo(view.ppm / ZOOM_STEP)} disabled={!custom} aria-label="Zoom out">-</button>
          <button type="button" onClick={() => setCustom(null)} disabled={!custom}>Fit</button>
          <button type="button" onClick={() => panBy(-width / 2 / view.ppm)} disabled={!custom}>Earlier</button>
          <button type="button" onClick={() => panBy(width / 2 / view.ppm)} disabled={!custom}>Later</button>
        </div>
      )}

      {selected && (
        <aside className="map-drawer map-glass">
          <div className="drawer-scroll">
            <TimelineItemPanel key={selected.id} worldId={id} item={selected} canEdit={canEdit} onChanged={reloadItems} onRemoved={handleRemoved} onClose={() => setSelectedId(null)}/>
          </div>
        </aside>
      )}

      {!selected && canEdit && drawer === 'add' && (
        <aside className="map-drawer map-glass">
          <div className="drawer-scroll">
            <TimelineAddPanel worldId={id} entries={entries} types={types} items={items} onAdded={handleAdded} onOpenSettings={() => setDrawer('settings')} onClose={() => setDrawer('')}/>
          </div>
        </aside>
      )}

      {!selected && canEdit && drawer === 'settings' && (
        <aside className="map-drawer map-glass">
          <div className="drawer-scroll">
            <TimelineSettings worldId={id} types={types} onChanged={handleTypesChanged} onClose={() => setDrawer('')}/>
          </div>
        </aside>
      )}
    </div>
  );
}
