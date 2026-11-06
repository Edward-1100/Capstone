import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listEntriesRequest } from '../../api/entries';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { listRelationshipTypesRequest } from '../../api/relationshipTypes';
import { listTagsRequest } from '../../api/tags';
import { getWorldRequest } from '../../api/worlds';
import Page from '../../components/Page';
import PickBox from '../../components/PickBox';
import RelationPicker from '../../components/RelationPicker';
import TagSwatch from '../../components/TagSwatch';

function splitList(value) {
  return value ? value.split(',').filter((item) => item !== '') : [];
}

export default function EntriesPage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const typesParam = searchParams.get('types') || '';
  const notTypesParam = searchParams.get('notTypes') || '';
  const tagsParam = searchParams.get('tags') || '';
  const notParam = searchParams.get('not') || '';
  const matchParam = searchParams.get('match') === 'any' ? 'any' : 'all';
  const relatedParam = searchParams.get('rel') || '';
  const notRelatedParam = searchParams.get('notRel') || '';

  const [world, setWorld] = useState(null);
  const [types, setTypes] = useState([]);
  const [tags, setTags] = useState([]);
  const [relationshipTypes, setRelationshipTypes] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState(qParam);
  const [loading, setLoading] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(() => [typesParam, notTypesParam, tagsParam, notParam, relatedParam, notRelatedParam].some((item) => item !== ''));
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getWorldRequest(id), listEntryTypesRequest(id), listTagsRequest(id), listEntriesRequest(id), listRelationshipTypesRequest(id)])
      .then(([worldData, typeData, tagData, entryData, relationshipTypeData]) => {
        setWorld(worldData);
        setTypes(typeData);
        setTags(tagData);
        setRelationshipTypes(relationshipTypeData);
        setAllEntries(entryData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  useEffect(() => {
    listEntriesRequest(id, {
      q: qParam,
      types: splitList(typesParam),
      excludeTypes: splitList(notTypesParam),
      tags: splitList(tagsParam),
      excludeTags: splitList(notParam),
      tagMode: matchParam,
      relations: splitList(relatedParam),
      excludeRelations: splitList(notRelatedParam),
    })
      .then((data) => {
        setEntries(data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, qParam, typesParam, notTypesParam, tagsParam, notParam, matchParam, relatedParam, notRelatedParam]);

  const includedTypes = splitList(typesParam);
  const excludedTypes = splitList(notTypesParam);
  const included = splitList(tagsParam);
  const excluded = splitList(notParam);
  const related = splitList(relatedParam);
  const notRelated = splitList(notRelatedParam);
  const hasFilters = qParam !== '' || includedTypes.length > 0 || excludedTypes.length > 0 || included.length > 0 || excluded.length > 0 || related.length > 0 || notRelated.length > 0;

  function updateParams(changes) {
    const merged = Object.assign({q: qParam, types: typesParam, notTypes: notTypesParam, tags: tagsParam, not: notParam, match: matchParam === 'any' ? 'any' : '', rel: relatedParam, notRel: notRelatedParam}, changes);
    const params = {};

    for (const key of Object.keys(merged)) {
      if (merged[key]) {
        params[key] = merged[key];
      }
    }

    setSearchParams(params);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() !== qParam) {
        updateParams({q: search.trim()});
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  function addTo(key, otherKey, list, otherList, value) {
    updateParams({[key]: list.filter((item) => item !== value).concat([value]).join(','), [otherKey]: otherList.filter((item) => item !== value).join(',')});
  }

  function removeFrom(key, list, value) {
    updateParams({[key]: list.filter((item) => item !== value).join(',')});
  }

  function clearFilters() {
    setSearch('');
    setSearchParams({});
  }

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';
  const newLink = includedTypes.length === 1 && includedTypes[0] !== 'none' ? `/worlds/${id}/entries/new?type=${includedTypes[0]}` : `/worlds/${id}/entries/new`;
  const typeOptions = [{id: 'none', name: 'No type'}].concat(types).map((type) => ({
    id: type.id,
    label: type.name,
    count: allEntries.filter((entry) => (type.id === 'none' ? !entry.typeId : entry.typeId === type.id)).length,
  }));
  const tagOptions = tags.map((tag) => ({id: tag.id, label: tag.name, count: tag.entryCount, swatch: <TagSwatch color={tag.color}/>}));

  const columns = [
    {title: 'Entry type', short: 'Type', options: typeOptions, plus: [includedTypes, 'types', excludedTypes, 'notTypes'], placeholder: 'Type a type'},
    {title: 'Tag', short: 'Tag', options: tagOptions, plus: [included, 'tags', excluded, 'not'], placeholder: 'Type a tag'},
  ];

  return (
    <Page size="medium" crumbs={[{to: `/worlds/${id}`, label: world.name}, {label: 'Entries'}]}>
      <div className="panel">
        <div className="toolbar">
          <div className="line">
            <label htmlFor="entrySearch">Search</label>

            <input id="entrySearch" type="text" placeholder="Name or description" value={search} onChange={(e) => setSearch(e.target.value)}/>

            <button type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(!advancedOpen)}>{advancedOpen ? 'Hide advanced' : 'Advanced'}</button>

            {hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}
          </div>

          {canEdit && <Link className="button" to={newLink}>New entry</Link>}
        </div>

        {advancedOpen && (
          <div className="advanced">
            <div className="adv-grid">
              {columns.map((column) => (
                <div key={`include-${column.title}`} className="adv-cell">
                  <span className="adv-label">{column.short} include</span>

                  <PickBox options={column.options} selected={column.plus[0]} placeholder={column.placeholder} label={`Include ${column.title}`} onAdd={(value) => addTo(column.plus[1], column.plus[3], column.plus[0], column.plus[2], value)} onRemove={(value) => removeFrom(column.plus[1], column.plus[0], value)}/>
                </div>
              ))}

              <div className="adv-cell">
                <span className="adv-label">Relationship include</span>

                <RelationPicker relationshipTypes={relationshipTypes} entries={allEntries} selected={related} label="Include" onAdd={(value) => addTo('rel', 'notRel', related, notRelated, value)} onRemove={(value) => removeFrom('rel', related, value)}/>
              </div>

              {columns.map((column) => (
                <div key={`exclude-${column.title}`} className="adv-cell">
                  <span className="adv-label">{column.short} exclude</span>

                  <PickBox options={column.options} selected={column.plus[2]} placeholder={column.placeholder} label={`Exclude ${column.title}`} onAdd={(value) => addTo(column.plus[3], column.plus[1], column.plus[2], column.plus[0], value)} onRemove={(value) => removeFrom(column.plus[3], column.plus[2], value)}/>
                </div>
              ))}

              <div className="adv-cell">
                <span className="adv-label">Relationship exclude</span>

                <RelationPicker relationshipTypes={relationshipTypes} entries={allEntries} selected={notRelated} label="Exclude" onAdd={(value) => addTo('notRel', 'rel', notRelated, related, value)} onRemove={(value) => removeFrom('notRel', notRelated, value)}/>
              </div>
            </div>

            {included.length > 1 && (
              <div className="line">
                <label htmlFor="tagMatch">Combine included tags with</label>

                <select id="tagMatch" className="small" value={matchParam} onChange={(e) => updateParams({match: e.target.value === 'any' ? 'any' : ''})}>
                  <option value="all">and</option>
                  <option value="any">or</option>
                </select>
              </div>
            )}
          </div>
        )}

        {loading && <p>Loading</p>}

        {error && <p role="alert">{error}</p>}

        {!loading && !error && entries.length === 0 && <p className="muted">{hasFilters ? 'No entries match these filters' : 'No entries yet'}</p>}

        <ul className="entry-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link to={`/worlds/${id}/entries/${entry.id}`}>{entry.name}</Link>

              <span className="muted">{entry.typeName || 'no type'}</span>

              <span className="entry-tags">
                {entry.tags.map((tag) => <span key={tag.id}><TagSwatch color={tag.color}/>{tag.name}</span>)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  );
}
