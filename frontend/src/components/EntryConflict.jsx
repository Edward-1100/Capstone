import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { diffWords } from '../utils/diff';
import { formatValue } from '../utils/fields';

function findDefinition(conflict, current) {
  return conflict.fieldId ? current.typeFields.find((item) => item.id === conflict.fieldId) : null;
}

function isLong(conflict, current) {
  const definition = findDefinition(conflict, current);

  return conflict.key === 'description' || Boolean(definition && definition.fieldType === 'long_text');
}

function show(conflict, side, current, types, allEntries) {
  const value = side === 'theirs' ? conflict.theirs : conflict.mine;

  if (conflict.key === 'typeId') {
    const type = side === 'theirs' ? {name: current.typeName} : types.find((item) => item.id === value);

    return type && type.name ? type.name : 'No type';
  }

  if (conflict.key === 'parentId') {
    const parent = side === 'theirs' ? current.parent : allEntries.find((item) => item.id === value);

    return parent ? parent.name : 'Nothing';
  }

  const definition = findDefinition(conflict, current);

  if (definition) {
    return formatValue(definition, value) || 'not set';
  }

  return value || 'empty';
}

function Parts({parts}) {
  return parts.map((part, index) => (part.changed ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>));
}

function sideNames(theirsName, mineName) {
  if (theirsName === mineName) {
    return {theirs: `${theirsName} (saved version)`, mine: `${mineName} (your edit)`};
  }

  return {theirs: theirsName, mine: mineName};
}

export default function EntryConflict({current, items, choices, types, allEntries, mineName, onChoose, onSave, onDiscard}) {
  const dialog = useRef(null);
  const theirsName = current.updatedBy || 'Someone else';
  const names = sideNames(theirsName, mineName);

  useEffect(() => {
    const previous = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    dialog.current.focus();

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function handleKeyDown(event) {
    if (event.key !== 'Tab') {
      return;
    }

    const nodes = Array.from(dialog.current.querySelectorAll('input, button'));
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className="overlay">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="conflict-title" tabIndex={-1} ref={dialog} onKeyDown={handleKeyDown}>
        <div className="modal-head">
          <h2 id="conflict-title">{theirsName} changed this entry while you were editing</h2>
        </div>

        <div className="modal-body">
          {items.map((item) => {
            const chosen = choices[item.id] || 'theirs';
            const long = isLong(item, current);
            const parts = long ? diffWords(show(item, 'theirs', current, types, allEntries), show(item, 'mine', current, types, allEntries)) : null;

            return (
              <fieldset key={item.id} className="conflict-item">
                <legend>{item.label}</legend>

                <div className="conflict-sides">
                  {['theirs', 'mine'].map((side) => (
                    <label key={side} className={chosen === side ? 'conflict-side chosen' : 'conflict-side'}>
                      <span className="conflict-who">
                        <input type="radio" name={`conflict-${item.id}`} checked={chosen === side} onChange={() => onChoose(item.id, side)}/>
                        {names[side]}
                      </span>

                      <span className="conflict-value">{long ? <Parts parts={side === 'theirs' ? parts.left : parts.right}/> : show(item, side, current, types, allEntries)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        <div className="modal-foot">
          <button type="button" onClick={onDiscard}>Discard my changes</button>
          <button type="button" className="primary" onClick={onSave}>Save choices</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
