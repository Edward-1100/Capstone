import { useEffect, useState } from 'react';
import { parentOptionsRequest } from '../api/nesting';
import { createFieldRequest } from '../api/entryTypes';
import FieldForm from './FieldForm';
import FieldInput from './FieldInput';
import PickBox from './PickBox';
import { countLabel } from '../utils/text';
import TagSwatch from './TagSwatch';

function TypeCard({type, selected, onPick}) {
  return (
    <li>
      <button type="button" className={selected ? 'type-card selected' : 'type-card'} aria-pressed={selected} onClick={onPick}>
        <b>{type ? type.name : 'No type'}</b>
        <span>{type ? countLabel(type.fields.length, 'field', 'fields') : 'Plain entry'}</span>

        {type && (type.mappable || type.timelineable) && (
          <span className="type-flags">
            {type.mappable && <i>Map</i>}
            {type.timelineable && <i>Timeline</i>}
          </span>
        )}
      </button>
    </li>
  );
}

export default function EntryForm({worldId, initial, types, tags, submitLabel, onSubmit, onTypesChanged}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [typeId, setTypeId] = useState(initial.typeId || '');
  const [values, setValues] = useState(initial.fields || {});
  const [parentId, setParentId] = useState('');
  const [parents, setParents] = useState([]);
  const [tagIds, setTagIds] = useState([]);
  const [typeSearch, setTypeSearch] = useState('');
  const [addingField, setAddingField] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedType = types.find((type) => type.id === typeId);
  const definitions = selectedType ? selectedType.fields : [];
  const nestable = Boolean(selectedType) && selectedType.nestMode !== 'none';

  useEffect(() => {
    setParentId('');
    setParents([]);

    if (!nestable) {
      return;
    }

    parentOptionsRequest(worldId, typeId)
      .then(setParents)
      .catch(() => setParents([]));
  }, [worldId, typeId, nestable]);

  function setValue(fieldId, value) {
    setValues(Object.assign({}, values, {[fieldId]: value}));
  }

  function toggleTag(tagId) {
    setTagIds(tagIds.includes(tagId) ? tagIds.filter((item) => item !== tagId) : tagIds.concat([tagId]));
  }

  async function handleCreateField(data) {
    await createFieldRequest(worldId, typeId, {name: data.name, fieldType: data.fieldType, required: data.required, config: data.config});
    setAddingField(false);
    await onTypesChanged();
  }

  function pickType(nextId) {
    setAddingField(false);
    setTypeId(nextId);
    setValues({});
  }

  function buildFields() {
    const fields = {};

    for (const definition of definitions) {
      const value = values[definition.id];
      const blank = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

      fields[definition.id] = blank ? null : value;
    }

    return fields;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await onSubmit({name, description, typeId: typeId || null, parentId: parentId || null, fields: buildFields()}, tagIds);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const typeTerm = typeSearch.trim().toLowerCase();
  const shownTypes = types.filter((type) => type.name.toLowerCase().includes(typeTerm));

  const tagOptions = tags.map((tag) => ({id: tag.id, label: tag.name, count: tag.entryCount, swatch: <TagSwatch color={tag.color}/>}));

  return (
    <form className="entry-new" onSubmit={handleSubmit}>
      <div className="entry-top">
        <section className="card">
          <div className="form-grid">
            <div className="span">
              <label htmlFor="name">Name</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus/>
            </div>

            <div className="span">
              <label htmlFor="description">Description</label>
              <textarea id="description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={20000}/>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Type</h2>

            <input type="search" aria-label="Search types" placeholder="Search types" value={typeSearch} onChange={(e) => setTypeSearch(e.target.value)}/>
          </div>

          <ul className="type-cards">
            {typeTerm === '' && <TypeCard type={null} selected={typeId === ''} onPick={() => pickType('')}/>}
            {shownTypes.map((type) => <TypeCard key={type.id} type={type} selected={type.id === typeId} onPick={() => pickType(type.id)}/>)}
          </ul>

          {tags.length > 0 && (
            <div className="tags-block">
              <div className="card-head"><h2>Tags</h2></div>

              <PickBox options={tagOptions} selected={tagIds} placeholder="Search to add a tag" label="Add a tag" onAdd={(id) => setTagIds(tagIds.concat([id]))} onRemove={(id) => setTagIds(tagIds.filter((item) => item !== id))}/>
            </div>
          )}
        </section>
      </div>

      {selectedType && (
        <section className="card">
          <div className="card-head">
            <h2>{selectedType.name} details</h2>

            {!addingField && selectedType.fields.length < 33 && <button type="button" onClick={() => setAddingField(true)}>Add field</button>}
          </div>

          {definitions.length === 0 && !addingField && <p className="muted">No details yet</p>}

          <div className="form-grid">
            {definitions.map((definition) => (
              <div key={definition.id} className={definition.fieldType === 'long_text' || definition.fieldType === 'multi_choice' ? 'span' : ''}>
                <label htmlFor={`field-${definition.id}`}>{definition.name}{definition.required && <b className="req" title="Required">*</b>}</label>
                <FieldInput definition={definition} value={values[definition.id]} onChange={(value) => setValue(definition.id, value)}/>
              </div>
            ))}
          </div>

          {addingField && (
            <div className="add-field-box">
              <FieldForm initial={{name: '', fieldType: 'text', required: false, config: {}}} submitLabel="Add field" onSubmit={handleCreateField} onCancel={() => setAddingField(false)}/>
            </div>
          )}
        </section>
      )}

      {nestable && (
        <section className="card">
          <div className="card-head"><h2>Place</h2></div>

          <label htmlFor="parent">Inside</label>

          <select id="parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Not inside anything</option>
            {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}{parent.typeName ? ` (${parent.typeName})` : ''}</option>)}
          </select>
        </section>
      )}

      <div className="entry-actions">
        {error && <p role="alert">{error}</p>}

        <button type="submit" className="primary" disabled={submitting}>{submitLabel}</button>
      </div>
    </form>
  );
}
