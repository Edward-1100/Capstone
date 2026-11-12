import { useEffect, useRef, useState } from 'react';
import { distance, fitView, midpoint, pointToFraction, transformView } from '../utils/mapView';
import MapPin from './MapPin';

const ZOOM_STEP = 1.5;
const DRAG_THRESHOLD = 4;

function relative(point, rect) {
  return {x: point.x - rect.left, y: point.y - rect.top};
}

export default function MapViewport({imageUrl, name, markers, selectedId, placing, canEdit, onSelect, onMoveMarker, onPlace, onBackground}) {
  const stageRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const pinDrag = useRef(null);
  const pinTap = useRef(null);

  const [size, setSize] = useState(null);
  const [natural, setNatural] = useState(null);
  const [view, setView] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [moving, setMoving] = useState(null);

  const ready = size !== null && natural !== null;
  const current = ready ? (view || fitView(size, natural)) : null;

  useEffect(() => {
    const stage = stageRef.current;
    const observer = new ResizeObserver((entries) => setSize({w: entries[0].contentRect.width, h: entries[0].contentRect.height}));

    observer.observe(stage);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready) {
      return undefined;
    }

    const stage = stageRef.current;

    function handleWheel(event) {
      event.preventDefault();

      const rect = stage.getBoundingClientRect();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const point = relative({x: event.clientX, y: event.clientY}, rect);

      setView((previous) => transformView(previous || fitView(size, natural), point, point, Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015)), size, natural));
    }

    stage.addEventListener('wheel', handleWheel, {passive: false});

    return () => stage.removeEventListener('wheel', handleWheel);
  }, [ready, size, natural]);

  function handleLoad(event) {
    setNatural({w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight});
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {x: event.clientX, y: event.clientY});

    if (pointers.current.size === 1) {
      gesture.current = {startX: event.clientX, startY: event.clientY, moved: false};
    } else if (gesture.current) {
      gesture.current.moved = true;
    }
  }

  function handlePointerMove(event) {
    const previous = pointers.current.get(event.pointerId);

    if (!previous || !gesture.current || !ready) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const next = {x: event.clientX, y: event.clientY};
    const others = Array.from(pointers.current.entries()).filter((entry) => entry[0] !== event.pointerId);

    if (others.length === 0) {
      if (!gesture.current.moved && distance(next, {x: gesture.current.startX, y: gesture.current.startY}) < DRAG_THRESHOLD) {
        return;
      }

      gesture.current.moved = true;
      setDragging(true);
      setView((base) => transformView(base || fitView(size, natural), relative(previous, rect), relative(next, rect), 1, size, natural));
    } else {
      const anchor = others[0][1];
      const before = distance(previous, anchor) || 1;

      gesture.current.moved = true;
      setView((base) => transformView(base || fitView(size, natural), relative(midpoint(previous, anchor), rect), relative(midpoint(next, anchor), rect), distance(next, anchor) / before, size, natural));
    }

    pointers.current.set(event.pointerId, next);
  }

  function handlePointerUp(event) {
    const tracked = pointers.current.delete(event.pointerId);
    const active = gesture.current;
    const tapped = pinTap.current;

    pinTap.current = null;

    if (pointers.current.size > 0) {
      return;
    }

    gesture.current = null;
    setDragging(false);

    if (!tracked || !active || active.moved || !ready) {
      return;
    }

    if (tapped && !placing) {
      onSelect(tapped);
    } else if (placing) {
      const point = pointToFraction(current, relative({x: event.clientX, y: event.clientY}, event.currentTarget.getBoundingClientRect()), natural);

      onPlace(point.x, point.y);
    } else {
      onBackground();
    }
  }

  function handlePointerCancel(event) {
    pointers.current.delete(event.pointerId);
    pinTap.current = null;

    if (pointers.current.size === 0) {
      gesture.current = null;
      setDragging(false);
    }
  }

  function handlePinDown(event, marker) {
    if (!canEdit || !placing || placing.markerId !== marker.id || !ready || (event.pointerType === 'mouse' && event.button !== 0)) {
      pinTap.current = marker.id;

      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pinDrag.current = {id: marker.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: marker.x, originY: marker.y, moved: false};
  }

  function handlePinMove(event) {
    const drag = pinDrag.current;

    event.stopPropagation();

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
      return;
    }

    drag.moved = true;
    drag.x = Math.min(1, Math.max(0, drag.originX + dx / (current.scale * natural.w)));
    drag.y = Math.min(1, Math.max(0, drag.originY + dy / (current.scale * natural.h)));
    setMoving({id: drag.id, x: drag.x, y: drag.y});
  }

  function handlePinUp(event) {
    const drag = pinDrag.current;

    event.stopPropagation();

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    pinDrag.current = null;
    setMoving(null);

    if (drag.moved) {
      onMoveMarker(drag.id, drag.x, drag.y);
    }
  }

  function handlePinCancel(event) {
    event.stopPropagation();
    pinDrag.current = null;
    setMoving(null);
  }

  function handlePinClick(event, markerId) {
    if (event.detail === 0) {
      onSelect(markerId);
    }
  }

  function zoomBy(factor) {
    if (!ready) {
      return;
    }

    const center = {x: size.w / 2, y: size.h / 2};

    setView((base) => transformView(base || fitView(size, natural), center, center, factor, size, natural));
  }

  const stageClasses = ['map-stage'].concat(placing ? ['placing'] : []).concat(dragging ? ['dragging'] : []).join(' ');

  return (
    <div className="map-view">
      <div ref={stageRef} className={stageClasses} role="presentation" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel}>
        <div className={current ? 'map-world' : 'map-world loading'} style={current ? {width: natural.w, height: natural.h, transform: `translate(${current.x}px, ${current.y}px) scale(${current.scale})`} : undefined}>
          <img src={imageUrl} alt={name} draggable={false} onLoad={handleLoad}/>

          {current && markers.map((marker) => {
            const shown = moving && moving.id === marker.id ? moving : marker;
            const classes = ['map-marker'].concat(moving && moving.id === marker.id ? ['moving'] : []).concat(canEdit && placing && placing.markerId === marker.id ? ['draggable'] : []).join(' ');

            return (
              <button
                key={marker.id}
                type="button"
                className={classes}
                style={{left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, transform: `translate(-50%, -100%) scale(${1 / current.scale})`}}
                aria-label={marker.entryName}
                title={marker.entryName}
                onPointerDown={(event) => handlePinDown(event, marker)}
                onPointerMove={handlePinMove}
                onPointerUp={handlePinUp}
                onPointerCancel={handlePinCancel}
                onClick={(event) => handlePinClick(event, marker.id)}
              >
                <MapPin color={marker.color} innerColor={marker.innerColor} imageUrl={marker.imageUrl} imageScale={marker.imageScale} imageX={marker.imageX} imageY={marker.imageY} selected={marker.id === selectedId}/>
              </button>
            );
          })}
        </div>
      </div>

      <div className="map-zoom map-glass">
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>-</button>
        <button type="button" onClick={() => setView(null)}>Fit</button>
      </div>
    </div>
  );
}
