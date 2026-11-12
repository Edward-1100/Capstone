const MIN_VISIBLE = 64;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function fitScale(size, natural) {
  return Math.min(size.w / natural.w, size.h / natural.h);
}

export function viewLimits(size, natural) {
  const fit = fitScale(size, natural);

  return {min: fit * 0.5, max: Math.max(fit * 16, 8)};
}

export function fitView(size, natural) {
  const scale = fitScale(size, natural);

  return {scale, x: (size.w - natural.w * scale) / 2, y: (size.h - natural.h * scale) / 2};
}

export function clampView(view, size, natural) {
  const width = natural.w * view.scale;
  const height = natural.h * view.scale;

  return {
    scale: view.scale,
    x: clamp(view.x, MIN_VISIBLE - width, size.w - MIN_VISIBLE),
    y: clamp(view.y, MIN_VISIBLE - height, size.h - MIN_VISIBLE),
  };
}

export function transformView(view, from, to, factor, size, natural) {
  const limits = viewLimits(size, natural);
  const scale = clamp(view.scale * factor, limits.min, limits.max);
  const anchorX = (from.x - view.x) / view.scale;
  const anchorY = (from.y - view.y) / view.scale;

  return clampView({scale, x: to.x - anchorX * scale, y: to.y - anchorY * scale}, size, natural);
}

export function pointToFraction(view, point, natural) {
  return {
    x: clamp((point.x - view.x) / view.scale / natural.w, 0, 1),
    y: clamp((point.y - view.y) / view.scale / natural.h, 0, 1),
  };
}

export function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function midpoint(first, second) {
  return {x: (first.x + second.x) / 2, y: (first.y + second.y) / 2};
}
