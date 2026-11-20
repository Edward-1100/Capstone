import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, addItems, removeItems } from '../utils/transfer';

const LIMIT = 300;

function GroupCheck({checked, indeterminate, disabled, label, onChange}) {
  const box = useRef(null);

  useEffect(() => {
    if (box.current) {
      box.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label>
      <input ref={box} type="checkbox" checked={checked} disabled={disabled} onChange={onChange}/>
      {label}
    </label>
  );
}

export default function TransferPicker({manifest, selection, onChange, clashes = null, resolutions = null, onResolve = null, mapSlots = null}) {
  const [open, setOpen] = useState({});
  const [filters, setFilters] = useState({});

  function creates(key, ref) {
    if (!clashes || !clashes[key][ref]) {
      return true;
    }

    return resolutions[key][ref] && resolutions[key][ref].action === 'rename';
  }

  function fitMaps(items, chosen) {
    let room = mapSlots.free - mapSlots.creating;
    const refs = [];

    for (const item of items) {
      if (chosen.has(item.ref)) {
        continue;
      }

      if (clashes && clashes.maps[item.ref]) {
        refs.push(item.ref);
      } else if (room > 0) {
        refs.push(item.ref);
        room -= 1;
      }
    }

    return refs;
  }

  function toggleGroup(key, items, chosen, on) {
    if (!on) {
      onChange(removeItems(manifest, selection, key, items.map((item) => item.ref)));

      return;
    }

    const refs = key === 'maps' && mapSlots ? fitMaps(items, chosen) : items.map((item) => item.ref);

    onChange(addItems(manifest, selection, key, refs));
  }

  function toggleItem(key, ref, on) {
    onChange(on ? addItems(manifest, selection, key, [ref]) : removeItems(manifest, selection, key, [ref]));
  }

  function resolve(key, item, action) {
    const current = resolutions[key][item.ref];
    const name = action === 'rename' && !current.name ? `${item.name} (imported)` : current.name;

    onResolve(key, item.ref, {action, name});
  }

  return (
    <div className="picker">
      {CATEGORIES.map((category) => {
        const key = category.key;
        const items = manifest[key];
        const chosen = new Set(selection[key]);
        const isOpen = Boolean(open[key]);
        const filter = (filters[key] || '').trim().toLowerCase();
        const shown = items.filter((item) => !filter || item.name.toLowerCase().includes(filter));
        const locked = key === 'maps' && mapSlots !== null && mapSlots.free <= 0;
        const full = key === 'maps' && mapSlots !== null && mapSlots.creating >= mapSlots.free;

        if (items.length === 0) {
          return null;
        }

        return (
          <div className="pick-group" key={key}>
            <div className="pick-head">
              <GroupCheck checked={chosen.size === items.length} indeterminate={chosen.size > 0 && chosen.size < items.length} disabled={locked} label={category.label} onChange={(event) => toggleGroup(key, items, chosen, event.target.checked)}/>

              <span className="muted">{chosen.size} of {items.length}{key === 'maps' && mapSlots ? `, ${Math.max(mapSlots.free, 0)} open` : ''}</span>

              <button type="button" onClick={() => setOpen(Object.assign({}, open, {[key]: !isOpen}))}>{isOpen ? 'Collapse' : 'Expand'}</button>
            </div>

            {isOpen && (
              <div className="pick-body">
                {items.length > 8 && <input type="text" aria-label={`Filter ${category.label}`} placeholder="Filter" value={filters[key] || ''} onChange={(event) => setFilters(Object.assign({}, filters, {[key]: event.target.value}))}/>}

                <ul className="pick-list">
                  {shown.slice(0, LIMIT).map((item) => {
                    const on = chosen.has(item.ref);
                    const clash = clashes ? clashes[key][item.ref] : null;
                    const resolution = on && clash && resolutions ? resolutions[key][item.ref] : null;
                    const blocked = !on && (locked || (full && creates(key, item.ref) && !clash));

                    return (
                      <li key={item.ref}>
                        <label>
                          <input type="checkbox" checked={on} disabled={blocked} onChange={(event) => toggleItem(key, item.ref, event.target.checked)}/>
                          <span>{item.name}</span>
                          {item.detail && <span className="muted">{item.detail}</span>}
                        </label>

                        {resolution && (
                          <span className="clash">
                            <select aria-label={`What to do with ${item.name}`} value={resolution.action} onChange={(event) => resolve(key, item, event.target.value)}>
                              <option value="keep">Keep existing</option>
                              <option value="replace">Use imported</option>
                              <option value="rename" disabled={key === 'maps' && full && resolution.action !== 'rename'}>Rename</option>
                            </select>

                            {resolution.action === 'rename' && <input type="text" aria-label={`New name for ${item.name}`} value={resolution.name} onChange={(event) => onResolve(key, item.ref, {action: 'rename', name: event.target.value})}/>}
                          </span>
                        )}
                      </li>
                    );
                  })}

                  {shown.length > LIMIT && <li className="muted">{shown.length - LIMIT} more, filter to find them</li>}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
