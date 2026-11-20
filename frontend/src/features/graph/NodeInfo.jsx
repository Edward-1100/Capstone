import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEntryRequest } from '../../api/entries';
import { formatValue } from '../../utils/fields';

export default function NodeInfo({worldId, data, nodeId, onSelect, onClose}) {
  const [entry, setEntry] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    setEntry(null);
    setFailed(false);

    getEntryRequest(worldId, nodeId)
      .then((result) => active && setEntry(result))
      .catch(() => active && setFailed(true));

    return () => {
      active = false;
    };
  }, [worldId, nodeId]);

  const node = data.nodes.find((item) => item.id === nodeId);

  if (!node) {
    return null;
  }

  const names = new Map(data.nodes.map((item) => [item.id, item]));
  const typeName = node.typeId ? (data.types.find((type) => type.id === node.typeId) || {}).name : null;
  const tags = node.tagIds.map((tagId) => data.tags.find((tag) => tag.id === tagId)).filter(Boolean);
  const relationships = [];

  for (const edge of data.edges) {
    if (edge.from !== nodeId && edge.to !== nodeId) {
      continue;
    }

    const outgoing = edge.from === nodeId;
    const other = names.get(outgoing ? edge.to : edge.from);
    const type = data.relationshipTypes.find((item) => item.id === edge.typeId);

    if (other && type) {
      relationships.push({id: edge.id, outgoing, type: type.name, other});
    }
  }

  relationships.sort((a, b) => a.type.localeCompare(b.type) || a.other.name.localeCompare(b.other.name));

  const byType = [];

  for (const item of relationships) {
    const last = byType[byType.length - 1];

    if (last && last.type === item.type) {
      last.items.push(item);
    } else {
      byType.push({type: item.type, items: [item]});
    }
  }

  const image = entry && entry.images && entry.images[0];
  const fields = entry ? entry.typeFields.map((field) => ({field, value: formatValue(field, entry.fields[field.id])})).filter((item) => item.value !== '') : [];
  const parent = entry && entry.parent;
  const children = entry ? entry.children : [];

  return (
    <aside className="graph-info map-glass" aria-label={`About ${node.name}`}>
      <div className="graph-panel-head">
        <h2>{node.name}</h2>
        <button type="button" onClick={onClose}>Close</button>
      </div>

      <div className="graph-panel-body">
        {image && <img className="graph-info-image" src={image.url} alt=""/>}

        <p className="graph-info-meta">
          <span className="badge">{typeName || 'No type'}</span>
          {tags.map((tag) => <span className="badge" key={tag.id}>{tag.name}</span>)}
        </p>

        {failed && <p role="alert">Could not load this entry</p>}
        {!entry && !failed && <p>Loading</p>}

        {entry && entry.description && (
          <details open className="info-section">
            <summary>Description</summary>
            <p className="graph-info-text">{entry.description}</p>
          </details>
        )}

        {fields.length > 0 && (
          <details open className="info-section">
            <summary>Details</summary>

            <dl className="facts">
              {fields.map(({field, value}) => (
                <div className="fact" key={field.id}>
                  <dt>{field.name}</dt>
                  <dd className={field.fieldType === 'long_text' ? 'long' : ''}>{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        {(parent || children.length > 0) && (
          <details open className="info-section">
            <summary>Nesting</summary>

            {parent && (
              <p>
                Inside {names.has(parent.id) ? <button type="button" className="link" onClick={() => onSelect(parent.id)}>{parent.name}</button> : parent.name}
              </p>
            )}

            {children.length > 0 && (
              <details open className="info-group">
                <summary>Contains ({children.length})</summary>

                <ul className="graph-info-list">
                  {children.map((child) => <li key={child.id}>{names.has(child.id) ? <button type="button" className="link" onClick={() => onSelect(child.id)}>{child.name}</button> : child.name}</li>)}
                </ul>
              </details>
            )}
          </details>
        )}

        <details open className="info-section">
          <summary>Relationships ({relationships.length})</summary>

          {relationships.length === 0 && <p className="muted">None</p>}

          {byType.map((group) => (
            <details open className="info-group" key={group.type}>
              <summary>{group.type} ({group.items.length})</summary>

              <ul className="graph-info-list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <span aria-label={item.outgoing ? 'to' : 'from'}>{item.outgoing ? '-->' : '<--'}</span>
                    <button type="button" className="link" onClick={() => onSelect(item.other.id)}>{item.other.name}</button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </details>

        {entry && entry.updatedBy && <p className="muted">Last updated by {entry.updatedBy}</p>}

        <div className="graph-info-open"><Link to={`/worlds/${worldId}/entries/${nodeId}`}>Open as a page</Link></div>
      </div>
    </aside>
  );
}
