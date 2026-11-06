import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listEntriesRequest } from '../api/entries';
import { listEntryTypesRequest } from '../api/entryTypes';
import { listRelationshipTypesRequest } from '../api/relationshipTypes';
import { clearTagRuleEntryRequest, getTagRuleRequest, previewTagRuleRequest, saveTagRuleRequest, setTagRuleEntryRequest } from '../api/tags';
import { countLabel } from '../utils/text';

const EMPTY_CONDITION = {exclude: false, kind: 'type', entryTypeId: '', relationshipTypeId: '', side: 'either', otherAny: true, otherEntryId: '', insideEntryId: ''};

function toDraft(condition) {
  return {
    exclude: condition.exclude,
    kind: condition.kind,
    entryTypeId: condition.entryTypeId || '',
    relationshipTypeId: condition.relationshipTypeId || '',
    side: condition.side || 'either',
    otherAny: condition.otherAny,
    otherEntryId: condition.otherEntryId || '',
    insideEntryId: condition.insideEntryId || '',
    broken: Boolean(condition.broken),
  };
}

function toPayload(condition) {
  return {
    exclude: condition.exclude,
    kind: condition.kind,
    entryTypeId: condition.entryTypeId,
    relationshipTypeId: condition.relationshipTypeId,
    side: condition.side,
    otherAny: condition.otherAny,
    otherEntryId: condition.otherEntryId,
    insideEntryId: condition.insideEntryId,
  };
}

export default function TagRules({worldId, tag, canEdit, focusEntryId, onChanged}) {
  const [rule, setRule] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [match, setMatch] = useState('all');
  const [dirty, setDirty] = useState(false);
  const [entryTypes, setEntryTypes] = useState([]);
  const [relationshipTypes, setRelationshipTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(Boolean(focusEntryId));
  const [preview, setPreview] = useState(null);
  const [addId, setAddId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getTagRuleRequest(worldId, tag.id), listEntryTypesRequest(worldId), listRelationshipTypesRequest(worldId), listEntriesRequest(worldId)])
      .then(([ruleData, typeData, relationshipTypeData, entryData]) => {
        setRule(ruleData);
        setConditions(ruleData.conditions.map(toDraft));
        setMatch(ruleData.match);
        setEntryTypes(typeData);
        setRelationshipTypes(relationshipTypeData);
        setEntries(entryData);
      })
      .catch((err) => setError(err.message));
  }, [worldId, tag.id]);

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    previewTagRuleRequest(worldId, tag.id)
      .then(setPreview)
      .catch((err) => setError(err.message));
  }, [worldId, tag.id, previewOpen, rule]);

  function updateCondition(index, changes) {
    setConditions(conditions.map((item, position) => (position === index ? Object.assign({}, item, changes) : item)));
    setDirty(true);
  }

  function changeKind(index, kind) {
    updateCondition(index, Object.assign({}, EMPTY_CONDITION, {exclude: conditions[index].exclude, kind}));
  }

  function handleMatchChange(event) {
    setMatch(event.target.value);
    setDirty(true);
  }

  function addCondition() {
    setConditions(conditions.concat([Object.assign({}, EMPTY_CONDITION)]));
    setDirty(true);
  }

  function removeCondition(index) {
    setConditions(conditions.filter((item, position) => position !== index));
    setDirty(true);
  }

  async function handleSave() {
    setError('');

    try {
      const saved = await saveTagRuleRequest(worldId, tag.id, {match, conditions: conditions.map(toPayload)});

      setRule(saved);
      setConditions(saved.conditions.map(toDraft));
      setMatch(saved.match);
      setDirty(false);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeEntry(action) {
    setError('');

    try {
      await action();
      setAddId('');
      setPreview(await previewTagRuleRequest(worldId, tag.id));
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!rule) {
    return <p>{error || 'Loading'}</p>;
  }

  const includeCount = conditions.filter((item) => !item.exclude).length;
  const applied = preview ? preview.entries : [];
  const addable = entries.filter((entry) => !applied.some((item) => item.id === entry.id) && !(preview && preview.excluded.some((item) => item.id === entry.id)));

  return (
    <div className="rules">
      <h3>Rule</h3>

      {rule.paused && <p role="alert">This rule is paused because something it refers to was deleted. Fix or remove the highlighted condition to turn it back on.</p>}

      {conditions.length === 0 && <p className="muted">No conditions yet</p>}

      <ul className="conditions">
        {conditions.map((item, index) => (
          <li key={index} className={item.broken ? 'broken' : ''}>
            {canEdit ? (
              <div className="inline-form">
                <select aria-label="Include or except" value={item.exclude ? 'except' : 'include'} onChange={(e) => updateCondition(index, {exclude: e.target.value === 'except'})}>
                  <option value="include">Include if</option>
                  <option value="except">Except if</option>
                </select>

                <select aria-label="Condition" value={item.kind} onChange={(e) => changeKind(index, e.target.value)}>
                  <option value="type">entry type is</option>
                  <option value="relationship">it has the relationship</option>
                  <option value="inside">it is inside</option>
                </select>

                {item.kind === 'type' && (
                  <select aria-label="Entry type" value={item.entryTypeId} onChange={(e) => updateCondition(index, {entryTypeId: e.target.value})}>
                    <option value="">Choose a type</option>
                    {entryTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                )}

                {item.kind === 'relationship' && (
                  <>
                    <select aria-label="Relationship type" value={item.relationshipTypeId} onChange={(e) => updateCondition(index, {relationshipTypeId: e.target.value})}>
                      <option value="">Choose a type</option>
                      {relationshipTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select>

                    <select aria-label="Direction" value={item.side} onChange={(e) => updateCondition(index, {side: e.target.value})}>
                      <option value="either">in either direction</option>
                      <option value="from">from it</option>
                      <option value="to">to it</option>
                    </select>

                    <select aria-label="With" value={item.otherAny ? 'any' : 'one'} onChange={(e) => updateCondition(index, {otherAny: e.target.value === 'any', otherEntryId: ''})}>
                      <option value="any">with any entry</option>
                      <option value="one">with a specific entry</option>
                    </select>

                    {!item.otherAny && (
                      <select aria-label="Other entry" value={item.otherEntryId} onChange={(e) => updateCondition(index, {otherEntryId: e.target.value})}>
                        <option value="">Choose an entry</option>
                        {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                      </select>
                    )}
                  </>
                )}

                {item.kind === 'inside' && (
                  <select aria-label="Parent entry" value={item.insideEntryId} onChange={(e) => updateCondition(index, {insideEntryId: e.target.value})}>
                    <option value="">Choose an entry</option>
                    {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                )}

                <button type="button" onClick={() => removeCondition(index)}>Remove</button>
              </div>
            ) : (
              <span>{item.exclude ? 'Except if ' : 'Include if '}{describe(item, entryTypes, relationshipTypes, entries)}</span>
            )}

            {item.broken && <p className="muted">This points at something that was deleted. Choose another or remove it.</p>}
          </li>
        ))}
      </ul>

      {includeCount > 1 && (
        <div className="line">
          <label htmlFor={`match-${tag.id}`}>Combine include conditions with</label>

          <select id={`match-${tag.id}`} value={match} disabled={!canEdit} onChange={handleMatchChange}>
            <option value="all">and</option>
            <option value="any">or</option>
          </select>
        </div>
      )}

      {conditions.length > 0 && includeCount === 0 && <p className="muted">A rule needs at least one include condition to apply to anything.</p>}

      {canEdit && (
        <div className="cell-actions">
          <button type="button" onClick={addCondition} disabled={conditions.length >= 20}>Add condition</button>
          <button type="button" onClick={handleSave} disabled={!dirty}>Save rule</button>
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      <div className="preview-toggle">
        <button type="button" aria-expanded={previewOpen} onClick={() => setPreviewOpen(!previewOpen)}>
          {previewOpen ? 'Hide entries' : 'Show entries this applies to'}
        </button>
      </div>

      {previewOpen && !preview && <p>Loading</p>}

      {previewOpen && preview && (
        <div className="rule-preview">
          <p className="muted">{countLabel(preview.total, 'entry', 'entries')} get this tag from the rule{preview.total > applied.length ? `, showing the first ${applied.length}` : ''}.</p>

          <ul className="compact">
            {applied.map((entry) => (
              <li key={entry.id} className={entry.id === focusEntryId ? 'focus' : ''}>
                <Link to={`/worlds/${worldId}/entries/${entry.id}`}>{entry.name}</Link>

                <span className="muted">{entry.typeName || 'no type'}{entry.added ? ', added by hand' : ''}</span>

                {canEdit && (
                  <span className="row-actions">
                    {entry.added && <button type="button" onClick={() => changeEntry(() => clearTagRuleEntryRequest(worldId, tag.id, entry.id))}>Undo add</button>}
                    {!entry.added && <button type="button" onClick={() => changeEntry(() => setTagRuleEntryRequest(worldId, tag.id, entry.id, true))}>Exclude</button>}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {preview.excluded.length > 0 && (
            <>
              <h3>Excluded</h3>

              <ul className="compact">
                {preview.excluded.map((entry) => (
                  <li key={entry.id} className={entry.id === focusEntryId ? 'focus' : ''}>
                    <Link to={`/worlds/${worldId}/entries/${entry.id}`}>{entry.name}</Link>

                    <span className="muted">{entry.typeName || 'no type'}</span>

                    {canEdit && <span className="row-actions"><button type="button" onClick={() => changeEntry(() => clearTagRuleEntryRequest(worldId, tag.id, entry.id))}>Undo exclude</button></span>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {canEdit && addable.length > 0 && (
            <div className="inline-form">
              <select aria-label="Add an entry" value={addId} onChange={(e) => setAddId(e.target.value)}>
                <option value="">Add an entry</option>
                {addable.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>

              <button type="button" disabled={!addId} onClick={() => changeEntry(() => setTagRuleEntryRequest(worldId, tag.id, addId, false))}>Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function nameOf(list, id, fallback) {
  const found = list.find((item) => item.id === id);

  return found ? found.name : fallback;
}

function describe(item, entryTypes, relationshipTypes, entries) {
  if (item.kind === 'type') {
    return `the entry type is ${nameOf(entryTypes, item.entryTypeId, 'a deleted type')}`;
  }

  if (item.kind === 'inside') {
    return `it is inside ${nameOf(entries, item.insideEntryId, 'a deleted entry')}`;
  }

  const side = item.side === 'from' ? ' from it' : (item.side === 'to' ? ' to it' : ' in either direction');
  const other = item.otherAny ? 'any entry' : nameOf(entries, item.otherEntryId, 'a deleted entry');

  return `it has the relationship ${nameOf(relationshipTypes, item.relationshipTypeId, 'a deleted type')}${side} with ${other}`;
}
