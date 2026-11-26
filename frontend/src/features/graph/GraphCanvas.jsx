import { useCallback, useEffect, useMemo, useRef } from 'react';
import { inkColor } from '../../utils/theme';
import { buildGroups, colorMap, createLayout, nodeColor, placeLabel, stepLayout, visibleGraph } from '../../utils/graph';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

function reducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function GraphCanvas({data, settings, selectedId, matchIds, inset, onSelect}) {
  const canvasRef = useRef(null);
  const state = useRef({view: {x: 0, y: 0, k: 1}, layout: null, alpha: 1, hover: null, drag: null, frame: 0, size: {w: 0, h: 0}, fitted: false});
  const live = useRef({});

  live.current = {settings, selectedId, matchIds, onSelect, data, inset};

  const shown = useMemo(() => visibleGraph(data, settings), [data, settings.hiddenTypes, settings.hiddenRelationships, settings.onlyTags, settings.hideUnconnected]);
  const groups = useMemo(
    () => buildGroups(data, settings, shown.nodes, shown.edges),
    [data, shown, settings.groupTypes, settings.groupTags, settings.groupRelationships, settings.groupFields, settings.onlyTags],
  );
  const colors = useMemo(() => colorMap(data, settings), [data, settings.colorBy]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const s = state.current;

    if (!canvas || !s.layout) {
      return;
    }

    const {settings: cfg, selectedId: selected, matchIds: matches, data: graphData} = live.current;
    const ratio = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const {x, y, k} = s.view;
    const focus = s.hover || selected;
    const near = new Set();

    if (focus) {
      near.add(focus);

      for (const link of s.layout.links) {
        if (link.a.id === focus) {
          near.add(link.b.id);
        } else if (link.b.id === focus) {
          near.add(link.a.id);
        }
      }
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, s.size.w, s.size.h);
    ctx.translate(x, y);
    ctx.scale(k, k);

    if (cfg.groupLabels) {
      ctx.textAlign = 'center';
      ctx.fillStyle = inkColor(0.16);
      ctx.font = `${16 / k}px sans-serif`;

      const placed = [];

      s.layout.groups
        .filter((group) => group.members.length >= 3)
        .sort((a, b) => b.members.length - a.members.length)
        .slice(0, 40)
        .forEach((group) => {
          const spot = placeLabel(placed, group.cx, group.cy - 12 / k, ctx.measureText(group.label).width, 16 / k);

          if (spot) {
            placed.push(spot);
            ctx.fillText(group.label, spot.x, spot.y);
          }
        });
    }

    ctx.lineWidth = 1 / k;

    for (const link of s.layout.links) {
      const lit = focus && (link.a.id === focus || link.b.id === focus);

      ctx.strokeStyle = lit ? inkColor(0.8) : focus ? inkColor(0.05) : inkColor(0.22);
      ctx.beginPath();
      ctx.moveTo(link.a.x, link.a.y);
      ctx.lineTo(link.b.x, link.b.y);
      ctx.stroke();
    }

    const searching = matches && matches.size > 0;

    for (const node of s.layout.nodes) {
      const dim = (focus && !near.has(node.id)) || (searching && !matches.has(node.id));

      ctx.globalAlpha = dim ? 0.18 : 1;
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();

      if (node.id === selected || (searching && matches.has(node.id))) {
        ctx.lineWidth = 2 / k;
        ctx.strokeStyle = inkColor(1);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.fillStyle = inkColor(1);
    ctx.font = `${12 / k}px sans-serif`;

    for (const node of s.layout.nodes) {
      const wanted = node.id === focus || near.has(node.id) || (searching && matches.has(node.id)) || (cfg.labels && k > 0.8);

      if (wanted && !(focus && !near.has(node.id))) {
        ctx.fillText(node.name, node.x + node.r + 3 / k, node.y + 4 / k);
      }
    }

    void graphData;
  }, []);

  const tick = useCallback(() => {
    const s = state.current;

    s.frame = 0;

    if (s.layout && s.alpha > 0.004) {
      stepLayout(s.layout, s.alpha, live.current.settings.strength);
      s.alpha *= 0.985;
    }

    draw();

    if (s.alpha > 0.004 || s.drag) {
      s.frame = requestAnimationFrame(tick);
    }
  }, [draw]);

  const request = useCallback(() => {
    if (!state.current.frame) {
      state.current.frame = requestAnimationFrame(tick);
    }
  }, [tick]);

  const fit = useCallback(() => {
    const s = state.current;

    if (!s.layout || s.layout.nodes.length === 0 || s.size.w === 0) {
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of s.layout.nodes) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }

    const width = Math.max(maxX - minX, 100);
    const height = Math.max(maxY - minY, 100);
    const inset = live.current.inset;
    const space = {w: s.size.w - inset.left - inset.right, h: s.size.h - inset.bottom};
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((space.w - 120) / width, (space.h - 160) / height)));

    s.view = {k, x: inset.left + space.w / 2 - ((minX + maxX) / 2) * k, y: 40 + (space.h - 40) / 2 - ((minY + maxY) / 2) * k};
    request();
  }, [request]);

  useEffect(() => {
    const s = state.current;
    const previous = s.layout ? new Map(s.layout.nodes.map((node) => [node.id, node])) : null;
    const layout = createLayout(shown.nodes, shown.edges, groups, previous);
    const byId = new Map(shown.nodes.map((node) => [node.id, node]));

    for (const item of layout.nodes) {
      item.name = byId.get(item.id).name;
    }

    s.layout = layout;
    s.alpha = 1;

    if (reducedMotion()) {
      for (let i = 0; i < 300; i += 1) {
        stepLayout(layout, Math.max(0.02, 1 - i / 300), live.current.settings.strength);
      }

      s.alpha = 0;
    }

    if (!s.fitted && s.size.w > 0) {
      for (let i = 0; i < 120; i += 1) {
        stepLayout(layout, Math.max(0.05, 1 - i / 120), live.current.settings.strength);
      }

      s.alpha = 0.5;
      s.fitted = true;
      fit();
    }

    request();
  }, [shown, groups, request, fit]);

  useEffect(() => {
    const s = state.current;

    if (!s.layout) {
      return;
    }

    const byId = new Map(data.nodes.map((node) => [node.id, node]));

    for (const item of s.layout.nodes) {
      item.color = nodeColor(data, settings, colors, byId.get(item.id));
    }

    request();
  }, [data, shown, settings, colors, request]);

  useEffect(() => {
    request();
  }, [settings.labels, settings.groupLabels, settings.strength, selectedId, matchIds, request]);

  useEffect(() => {
    const s = state.current;
    const node = selectedId && s.layout ? s.layout.index.get(selectedId) : null;

    if (!node) {
      return;
    }

    const {left, right, bottom} = live.current.inset;
    const sx = node.x * s.view.k + s.view.x;
    const sy = node.y * s.view.k + s.view.y;
    const inside = sx > left + 40 && sx < s.size.w - right - 40 && sy > 80 && sy < s.size.h - bottom - 40;

    if (!inside) {
      s.view.x = left + (s.size.w - left - right) / 2 - node.x * s.view.k;
      s.view.y = 40 + (s.size.h - bottom - 40) / 2 - node.y * s.view.k;
      request();
    }
  }, [selectedId, request]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const s = state.current;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      s.size = {w: rect.width, h: rect.height};
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);

      if (!s.fitted && s.layout) {
        s.fitted = true;
        fit();
      }

      request();
    }

    resize();

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;

    if (observer) {
      observer.observe(canvas);
    }

    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);

      if (observer) {
        observer.disconnect();
      }

      cancelAnimationFrame(s.frame);
      s.frame = 0;
    };
  }, [fit, request]);

  function toWorld(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    const {x, y, k} = state.current.view;

    return {x: (event.clientX - rect.left - x) / k, y: (event.clientY - rect.top - y) / k};
  }

  function hit(event) {
    const s = state.current;
    const point = toWorld(event);
    let found = null;

    if (!s.layout) {
      return null;
    }

    for (const node of s.layout.nodes) {
      const reach = node.r + 4 / s.view.k;

      if ((node.x - point.x) ** 2 + (node.y - point.y) ** 2 <= reach * reach) {
        found = node;
      }
    }

    return found;
  }

  function handleDown(event) {
    const s = state.current;
    const node = hit(event);

    canvasRef.current.setPointerCapture(event.pointerId);
    s.drag = {node, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false};

    if (node) {
      node.fixed = true;
    }

    request();
  }

  function handleMove(event) {
    const s = state.current;
    const drag = s.drag;

    if (!drag) {
      const node = hit(event);
      const id = node ? node.id : null;

      if (id !== s.hover) {
        s.hover = id;
        canvasRef.current.style.cursor = id ? 'pointer' : 'grab';
        request();
      }

      return;
    }

    if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 4) {
      drag.moved = true;
    }

    if (drag.node) {
      const point = toWorld(event);

      drag.node.x = point.x;
      drag.node.y = point.y;
      s.alpha = Math.max(s.alpha, 0.3);
    } else if (drag.moved) {
      s.view.x += event.clientX - drag.lastX;
      s.view.y += event.clientY - drag.lastY;
    }

    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    request();
  }

  function handleLeave() {
    state.current.hover = null;
    request();
  }

  function handleUp() {
    const s = state.current;
    const drag = s.drag;

    s.drag = null;

    if (!drag) {
      return;
    }

    if (drag.node) {
      drag.node.fixed = false;
    }

    if (!drag.moved) {
      live.current.onSelect(drag.node ? drag.node.id : null);
    }

    request();
  }

  function zoomAt(factor, cx, cy) {
    const s = state.current;
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.view.k * factor));
    const ratio = k / s.view.k;

    s.view = {k, x: cx - (cx - s.view.x) * ratio, y: cy - (cy - s.view.y) * ratio};
    request();
  }

  useEffect(() => {
    const canvas = canvasRef.current;

    function handleWheel(event) {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();

      zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
    }

    canvas.addEventListener('wheel', handleWheel, {passive: false});

    return () => canvas.removeEventListener('wheel', handleWheel);
  });

  function buttonZoom(factor) {
    const {w, h} = state.current.size;

    zoomAt(factor, w / 2, h / 2);
  }

  return (
    <>
      <canvas ref={canvasRef} className="graph-canvas" aria-label="Graph of entries and their relationships" onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} onPointerLeave={handleLeave}/>

      <div className="map-zoom map-glass">
        <button type="button" aria-label="Zoom in" onClick={() => buttonZoom(1.3)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => buttonZoom(1 / 1.3)}>-</button>
        <button type="button" onClick={fit}>Fit</button>
      </div>
    </>
  );
}
