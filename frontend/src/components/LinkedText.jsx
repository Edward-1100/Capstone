import { Link } from 'react-router-dom';

const LINK_PATTERN = /(\[\[[^[\]\n]{1,100}\]\])/;

export function findEntry(entries, name) {
  const wanted = name.trim().toLowerCase();
  let found = null;

  for (const entry of entries) {
    if (entry.name.toLowerCase() === wanted && (!found || entry.createdAt < found.createdAt)) {
      found = entry;
    }
  }

  return found;
}

export default function LinkedText({worldId, text, entries}) {
  return text.split(LINK_PATTERN).map((part, index) => {
    if (index % 2 === 0) {
      return part;
    }

    const name = part.slice(2, -2);
    const entry = findEntry(entries, name);

    if (!entry) {
      return <span key={index} className="missing-link" title="No entry has this name">{part}</span>;
    }

    return <Link key={index} to={`/worlds/${worldId}/entries/${entry.id}`}>{name}</Link>;
  });
}
