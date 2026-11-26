import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listEntriesRequest } from '../api/entries';
import { listEntryTypesRequest } from '../api/entryTypes';
import { listRelationshipTypesRequest } from '../api/relationshipTypes';
import { clearTagRuleEntryRequest, getTagRuleRequest, previewTagRuleRequest, saveTagRuleRequest, setTagRuleEntryRequest } from '../api/tags';
import { countLabel } from '../utils/text';
import { OPS, fieldList } from '../utils/tagRules';
import Typeahead from './Typeahead';
import SinglePick from './SinglePick';

const EMPTY_CONDITION = {exclude: false, kind: 'type', entryTypeId: '', relationshipTypeId: '', side: 'either', otherAny: true, otherEntryId: '', insideEntryId: '', fieldId: '', pickType: '', op: '', value: []};

function draftValue(condition) {
  if (condition.op === 'between') {
    return (condition.value || []).map(String);
  }

  if (condition.op === 'any' || condition.op === 'all') {
    return condition.value || [];
  }

  if (condition.op === 'is') {
    return [String(condition.value)];
  }

  return condition.value === null || condition.value === undefined ? [''] : [String(condition.value)];
}

function detailValue(condition) {
  const list = condition.value;

  if (condition.op === 'between') {
    return [Number(list[0]), Number(list[1])];
  }

  if (condition.op === 'any' || condition.op === 'all') {
    return list;
  }

  if (condition.op === 'is') {
    return list[0] === 'true';
  }

  return Number(list[0]);
}

function isComplete(condition, fields) {
  if (condition.kind !== 'detail') {
    return true;
  }

  const field = fields.find((item) => item.id === condition.fieldId);

  if (!field || !condition.op) {
    return false;
  }

  if (condition.op === 'any' || condition.op === 'all') {
    return condition.value.length > 0;
  }

  if (condition.op === 'is') {
    return condition.value[0] === 'true' || condition.value[0] === 'false';
  }

  const needed = condition.op === 'between' ? 2 : 1;

  return condition.value.length >= needed && condition.value.slice(0, needed).every((item) => item !== '' && Number.isFinite(Number(item)));
}

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
    fieldId: condition.fieldId || '',
    op: condition.op || '',
    value: condition.kind === 'detail' && condition.op ? draftValue(condition) : [],
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
    fieldId: condition.fieldId,
    op: condition.op,
    value: condition.kind === 'detail' ? detailValue(condition) : null,
  };
}

const KINDS = [['type', 'Entry type'], ['relationship', 'Relationship'], ['inside', 'Inside entry'], ['detail', 'Field']];
const SIDES = [['either', 'Either way'], ['from', 'From it'], ['to', 'To it']];

export default function TagRules({worldId, tag, canEdit, focusEntryId, onChanged, draft = false, onDraft}) {
  const [rule, setRule] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [match, setMatch] = useState('all');
  const [dirty, setDirty] = useState(false);
  const [entryTypes, setEntryTypes] = useState([]);
  const [relationshipTypes, setRelationshipTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(Boolean(focusEntryId));
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRule = draft ? Promise.resolve({paused: false, match: 'all', conditions: []}) : getTagRuleRequest(worldId, tag.id);

    Promise.all([loadRule, listEntryTypesRequest(worldId), listRelationshipTypesRequest(worldId), listEntriesRequest(worldId)])
      .then(([ruleData, typeData, relationshipTypeData, entryData]) => {
        setRule(ruleData);
        setConditions(ruleData.conditions.map(toDraft));
        setMatch(ruleData.match);
        setEntryTypes(typeData);
        setRelationshipTypes(relationshipTypeData);
        setEntries(entryData);
      })
      .catch((err) => setError(err.message));
  }, [worldId, tag.id, draft]);

  useEffect(() => {
    if (draft || !previewOpen) {
      return;
    }

    previewTagRuleRequest(worldId, tag.id)
      .then(setPreview)
      .catch((err) => setError(err.message));
  }, [worldId, tag.id, previewOpen, rule, draft]);

  useEffect(() => {
    if (draft && rule) {
      const known = fieldList(entryTypes);

      onDraft({match, conditions: conditions.map(toPayload), complete: conditions.every((item) => isComplete(item, known))});
    }
  }, [draft, rule, match, conditions, entryTypes, onDraft]);

  function updateCondition(index, changes) {
    setConditions(conditions.map((item, position) => (position === index ? Object.assign({}, item, changes) : item)));
    setDirty(true);
  }

  function changeField(index, fieldId) {
    const field = fields.find((item) => item.id === fieldId);
    const op = field ? OPS[field.fieldType][0][0] : '';

    updateCondition(index, {fieldId, op, value: op === 'is' ? ['true'] : (op === 'between' ? ['', ''] : (op === 'any' || op === 'all' ? [] : ['']))});
  }

  function changeOp(index, op) {
    const old = conditions[index].value;

    updateCondition(index, {op, value: op === 'between' ? [old[0] || '', ''] : (op === 'any' || op === 'all' ? old.filter(Boolean) : [old[0] || ''])});
  }

  function toggleOption(index, optionId) {
    const current = conditions[index].value;

    updateCondition(index, {value: current.includes(optionId) ? current.filter((item) => item !== optionId) : current.concat([optionId])});
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
      setPreview(await previewTagRuleRequest(worldId, tag.id));
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!rule) {
    return <p>{error || 'Loading'}</p>;
  }

  const fields = fieldList(entryTypes);
  const typeOptions = entryTypes.map((type) => ({id: type.id, label: type.name}));
  const relationOptions = relationshipTypes.map((type) => ({id: type.id, label: type.name}));
  const entryOptions = entries.map((entry) => ({id: entry.id, label: entry.name}));
  const fieldTypeOptions = entryTypes.filter((type) => fields.some((field) => field.typeId === type.id)).map((type) => ({id: type.id, label: type.name}));

  function fieldTypeOf(item) {
    const found = fields.find((field) => field.id === item.fieldId);

    return found ? found.typeId : (item.pickType || '');
  }

  const allComplete = conditions.every((item) => isComplete(item, fields));
  const includeCount = conditions.filter((item) => !item.exclude).length;
  const applied = preview ? preview.entries : [];
  const addable = entries.filter((entry) => !applied.some((item) => item.id === entry.id) && !(preview && preview.excluded.some((item) => item.id === entry.id)));

  return (
    <div className="rules">
      {rule.paused && <p role="alert">This rule is paused because something it refers to was deleted. Fix or remove the highlighted condition to turn it back on.</p>}

      {conditions.length === 0 && <p className="muted">No conditions yet</p>}

      <ul className="conditions">
        {conditions.map((item, index) => (
          <li key={index} className={item.broken ? 'broken' : ''}>
            {canEdit && (
              <div className="cond-edit">
                <div className="cond-bar">
                  <div className="toggle" role="group" aria-label="Include or except">
                    <button type="button" className={item.exclude ? '' : 'on'} onClick={() => updateCondition(index, {exclude: false})}>Include if</button>
                    <button type="button" className={item.exclude ? 'on' : ''} onClick={() => updateCondition(index, {exclude: true})}>Except if</button>
                  </div>

                  <div className="toggle" role="group" aria-label="Condition">
                    {KINDS.map(([kind, text]) => <button key={kind} type="button" className={item.kind === kind ? 'on' : ''} onClick={() => changeKind(index, kind)}>{text}</button>)}
                  </div>

                  <button type="button" onClick={() => removeCondition(index)}>Remove</button>
                </div>

                <div className="cond-body">
                  {item.kind === 'type' && <SinglePick options={typeOptions} value={item.entryTypeId} onChange={(value) => updateCondition(index, {entryTypeId: value})} placeholder="Search for an entry type" label="entry type" missing="A deleted type"/>}

                  {item.kind === 'relationship' && (
                    <>
                      <SinglePick options={relationOptions} value={item.relationshipTypeId} onChange={(value) => updateCondition(index, {relationshipTypeId: value})} placeholder="Search for a relationship type" label="relationship type" missing="A deleted type"/>

                      <div className="toggle" role="group" aria-label="Direction">
                        {SIDES.map(([side, text]) => <button key={side} type="button" className={item.side === side ? 'on' : ''} onClick={() => updateCondition(index, {side})}>{text}</button>)}
                      </div>

                      <div className="toggle" role="group" aria-label="With">
                        <button type="button" className={item.otherAny ? 'on' : ''} onClick={() => updateCondition(index, {otherAny: true, otherEntryId: ''})}>Any entry</button>
                        <button type="button" className={item.otherAny ? '' : 'on'} onClick={() => updateCondition(index, {otherAny: false})}>One entry</button>
                      </div>

                      {!item.otherAny && <SinglePick options={entryOptions} value={item.otherEntryId} onChange={(value) => updateCondition(index, {otherEntryId: value})} placeholder="Search for an entry" label="other entry" missing="A deleted entry"/>}
                    </>
                  )}

                  {item.kind === 'inside' && <SinglePick options={entryOptions} value={item.insideEntryId} onChange={(value) => updateCondition(index, {insideEntryId: value})} placeholder="Search for an entry" label="parent entry" missing="A deleted entry"/>}

                  {item.kind === 'detail' && (
                    <>
                      <SinglePick options={fieldTypeOptions} value={fieldTypeOf(item)} onChange={(value) => updateCondition(index, {pickType: value, fieldId: '', op: '', value: []})} placeholder="Search for an entry type" label="entry type of the field" missing="A deleted type"/>

                      {fieldTypeOf(item) && <SinglePick options={fields.filter((field) => field.typeId === fieldTypeOf(item)).map((field) => ({id: field.id, label: field.name}))} value={fields.some((field) => field.id === item.fieldId) ? item.fieldId : ''} onChange={(value) => changeField(index, value)} placeholder="Search for a field" label="field" missing="A deleted field"/>}

                      {item.fieldId && fields.some((field) => field.id === item.fieldId) && (
                        <DetailInputs
                          condition={item}
                          field={fields.find((field) => field.id === item.fieldId)}
                          onOp={(op) => changeOp(index, op)}
                          onValue={(value) => updateCondition(index, {value})}
                          onToggle={(optionId) => toggleOption(index, optionId)}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {!canEdit && <span>{item.exclude ? 'Except if ' : 'Include if '}{item.kind === 'detail' ? describeDetail(item, fields) : describe(item, entryTypes, relationshipTypes, entries)}</span>}

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
          {!draft && <button type="button" onClick={handleSave} disabled={!dirty || !allComplete}>Save rule</button>}
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      {!draft && <div className="preview-toggle">
        <button type="button" aria-expanded={previewOpen} onClick={() => setPreviewOpen(!previewOpen)}>
          {previewOpen ? 'Hide entries' : 'Show entries this applies to'}
        </button>
      </div>}

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
            <div className="pick-box">
              <Typeahead options={addable.map((entry) => ({id: entry.id, label: entry.name, count: entry.relationshipCount}))} onPick={(entryId) => changeEntry(() => setTagRuleEntryRequest(worldId, tag.id, entryId, false))} placeholder="Search to add an entry by hand" label="Add an entry"/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailInputs({condition, field, onOp, onValue, onToggle}) {
  const ops = OPS[field.fieldType];
  const options = (field.config && field.config.options) || [];
  const value = condition.value;

  return (
    <>
      {ops.length > 1 && (
        <div className="toggle" role="group" aria-label="Comparison">
          {ops.map(([key, label]) => <button key={key} type="button" className={condition.op === key ? 'on' : ''} onClick={() => onOp(key)}>{label}</button>)}
        </div>
      )}

      {(condition.op === 'eq' || condition.op === 'gte' || condition.op === 'lte') && (
        <input type="number" aria-label="Value" step="any" min={field.fieldType === 'scale' ? field.config.min : undefined} max={field.fieldType === 'scale' ? field.config.max : undefined} placeholder={field.fieldType === 'scale' ? `${field.config.min} to ${field.config.max}` : undefined} value={value[0] ?? ''} onChange={(e) => onValue([e.target.value])}/>
      )}

      {condition.op === 'between' && (
        <>
          <input type="number" aria-label="From" value={value[0] ?? ''} onChange={(e) => onValue([e.target.value, value[1] ?? ''])}/>
          <span>and</span>
          <input type="number" aria-label="To" value={value[1] ?? ''} onChange={(e) => onValue([value[0] ?? '', e.target.value])}/>
        </>
      )}

      {condition.op === 'is' && (
        <div className="toggle" role="group" aria-label="Value">
          <button type="button" className={value[0] === 'true' ? 'on' : ''} onClick={() => onValue(['true'])}>{(field.config && field.config.trueLabel) || 'True'}</button>
          <button type="button" className={value[0] === 'false' ? 'on' : ''} onClick={() => onValue(['false'])}>{(field.config && field.config.falseLabel) || 'False'}</button>
        </div>
      )}

      {(condition.op === 'any' || condition.op === 'all') && (
        <span className="multi-options">
          {options.map((option) => (
            <label key={option.id} className={value.includes(option.id) ? 'multi-option selected' : 'multi-option'}>
              <input type="checkbox" checked={value.includes(option.id)} onChange={() => onToggle(option.id)}/>
              {option.label}
            </label>
          ))}
        </span>
      )}
    </>
  );
}

function describeDetail(item, fields) {
  const field = fields.find((entry) => entry.id === item.fieldId);

  if (!field) {
    return 'a field that was deleted';
  }

  const options = (field.config && field.config.options) || [];
  const label = (OPS[field.fieldType].find(([key]) => key === item.op) || ['', item.op])[1];
  let shown;

  if (item.op === 'any' || item.op === 'all') {
    shown = item.value.map((id) => (options.find((option) => option.id === id) || {label: 'a deleted option'}).label).join(', ');
  } else if (item.op === 'between') {
    shown = `${item.value[0]} and ${item.value[1]}`;
  } else if (item.op === 'is') {
    shown = item.value[0] === 'true' ? ((field.config && field.config.trueLabel) || 'true') : ((field.config && field.config.falseLabel) || 'false');
  } else {
    shown = item.value[0];
  }

  return `${field.typeName}: ${field.name} ${label} ${shown}`;
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
