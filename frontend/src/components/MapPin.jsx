import { useEffect, useId, useState } from 'react';

const naturalSizes = new Map();

function useNatural(url) {
  const [size, setSize] = useState(url ? naturalSizes.get(url) || null : null);

  useEffect(() => {
    if (!url) {
      return undefined;
    }

    if (naturalSizes.has(url)) {
      setSize(naturalSizes.get(url));

      return undefined;
    }

    let active = true;
    const probe = new Image();

    probe.onload = () => {
      const found = {w: probe.naturalWidth, h: probe.naturalHeight};

      naturalSizes.set(url, found);

      if (active) {
        setSize(found);
      }
    };

    probe.src = url;

    return () => {
      active = false;
    };
  }, [url]);

  return size;
}

function placement(natural, scale, offsetX, offsetY) {
  const ratio = natural.w / natural.h;
  const zoom = Math.max(1, scale);
  const width = (ratio >= 1 ? 17 * ratio : 17) * zoom;
  const height = (ratio >= 1 ? 17 : 17 / ratio) * zoom;

  return {width, height, x: 16 - width / 2 + offsetX * ((width - 17) / 2), y: 15.5 - height / 2 + offsetY * ((height - 17) / 2)};
}

export default function MapPin({color, innerColor = '#ffffff', imageUrl, imageScale = 1, imageX = 0, imageY = 0, selected = false, size = 36}) {
  const clipId = useId();
  const natural = useNatural(imageUrl);
  const box = natural ? placement(natural, imageScale, imageX, imageY) : null;

  return (
    <svg className="map-pin" width={size} height={size * 1.375} viewBox="0 0 32 44" aria-hidden="true">
      <path d="M16 1C7.7 1 1 7.6 1 15.8c0 10.6 12.5 25 14.2 26.9a1.1 1.1 0 0 0 1.6 0C18.5 40.8 31 26.4 31 15.8 31 7.6 24.3 1 16 1z" fill={color} stroke={selected ? '#ffffff' : 'none'} strokeWidth="2"/>
      <circle cx="16" cy="15.5" r="10" fill={innerColor}/>

      {imageUrl && (
        <>
          <clipPath id={clipId}><circle cx="16" cy="15.5" r="8.5"/></clipPath>

          {box ? (
            <image href={imageUrl} x={box.x} y={box.y} width={box.width} height={box.height} preserveAspectRatio="none" clipPath={`url(#${clipId})`}/>
          ) : (
            <image href={imageUrl} x="7.5" y="7" width="17" height="17" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`}/>
          )}
        </>
      )}
    </svg>
  );
}