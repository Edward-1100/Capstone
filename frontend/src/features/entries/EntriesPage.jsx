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

function readMode() {
  try {
    return localStorage.getItem('view-entries') === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function splitList(value) {
  return value ? value.split(',').filter((item) => item !== '') : [];
}

const FILTER_GROUPS = [
  {title: 'Entry types', index: 0},
  {title: 'Tags', index: 1},
  {title: 'Relationships', kind: 'relationship'},
];

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState(readMode);
  const [error, setError] = useState('');
  const [sort, setSort] = useState({key: '', dir: ''});

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

  function chooseMode(next) {
    setMode(next);

    try {
      localStorage.setItem('view-entries', next);
    } catch {
      return;
    }
  }

  function toggleSort(key) {
    if (sort.key !== key) {
      setSort({key, dir: 'desc'});
    } else if (sort.dir === 'desc') {
      setSort({key, dir: 'asc'});
    } else {
      setSort({key: '', dir: ''});
    }
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

  const sorted = sort.key === '' ? entries : entries.slice().sort((first, second) => {
    const one = sort.key === 'updated' ? new Date(first.updatedAt).getTime() : first.relationshipCount;
    const two = sort.key === 'updated' ? new Date(second.updatedAt).getTime() : second.relationshipCount;

    return sort.dir === 'asc' ? one - two : two - one;
  });

  const columns = [
    {title: 'Entry type', short: 'Type', options: typeOptions, plus: [includedTypes, 'types', excludedTypes, 'notTypes'], placeholder: 'Type a type'},
    {title: 'Tag', short: 'Tag', options: tagOptions, plus: [included, 'tags', excluded, 'not'], placeholder: 'Type a tag'},
  ];

  return (
    <Page crumbs={[{to: `/worlds/${id}`, label: world.name}, {label: 'Entries'}]}>
      <div className="page-head">
        <h1 className="title">Entries</h1>

        {canEdit && <Link className="button primary" to={newLink}>New entry</Link>}
      </div>

      <div className="entries-layout">
        <aside className={filtersOpen ? 'filters open' : 'filters'}>
          <section className="card">
            <div className="card-head">
              <h2>Filters</h2>

              {hasFilters && <button type="button" onClick={clearFilters}>Clear all</button>}
            </div>

            <div className="sort-row" role="group" aria-label="Sort">
              {[['updated', 'Updated'], ['relations', 'Relations']].map(([key, text]) => (
                <button key={key} type="button" className={sort.key === key ? 'on' : ''} aria-pressed={sort.key === key} onClick={() => toggleSort(key)}>
                  {text}{sort.key === key ? (sort.dir === 'desc' ? ' (desc)' : ' (asc)') : ''}
                </button>
              ))}
            </div>

            {FILTER_GROUPS.map((group) => (
              <div key={group.title} className="filter-group">
                <h3>{group.title}</h3>

                {group.kind === 'relationship' ? (
                  <>
                    <h4 className="filter-sub">Include</h4>
                    <RelationPicker relationshipTypes={relationshipTypes} entries={allEntries} selected={related} label="Include" onAdd={(value) => addTo('rel', 'notRel', related, notRelated, value)} onRemove={(value) => removeFrom('rel', related, value)}/>

                    <h4 className="filter-sub">Exclude</h4>
                    <RelationPicker relationshipTypes={relationshipTypes} entries={allEntries} selected={notRelated} label="Exclude" onAdd={(value) => addTo('notRel', 'rel', notRelated, related, value)} onRemove={(value) => removeFrom('notRel', notRelated, value)}/>
                  </>
                ) : (
                  <>
                    <h4 className="filter-sub">Include</h4>
                    <PickBox options={columns[group.index].options} selected={columns[group.index].plus[0]} placeholder={columns[group.index].placeholder} label={`Include ${columns[group.index].title}`} onAdd={(value) => addTo(columns[group.index].plus[1], columns[group.index].plus[3], columns[group.index].plus[0], columns[group.index].plus[2], value)} onRemove={(value) => removeFrom(columns[group.index].plus[1], columns[group.index].plus[0], value)}/>

                    <h4 className="filter-sub">Exclude</h4>
                    <PickBox options={columns[group.index].options} selected={columns[group.index].plus[2]} placeholder={columns[group.index].placeholder} label={`Exclude ${columns[group.index].title}`} onAdd={(value) => addTo(columns[group.index].plus[3], columns[group.index].plus[1], columns[group.index].plus[2], columns[group.index].plus[0], value)} onRemove={(value) => removeFrom(columns[group.index].plus[3], columns[group.index].plus[2], value)}/>
                  </>
                )}

                {group.title === 'Tags' && included.length > 1 && (
                  <div className="line">
                    <label htmlFor="tagMatch">Combine included tags with</label>

                    <select id="tagMatch" className="small" value={matchParam} onChange={(e) => updateParams({match: e.target.value === 'any' ? 'any' : ''})}>
                      <option value="all">and</option>
                      <option value="any">or</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </section>
        </aside>

        <section className="card results">
          <div className="toolbar">
            <div className="entry-search">
              <input id="entrySearch" type="search" aria-label="Search entries" placeholder="Search by name or description" value={search} onChange={(e) => setSearch(e.target.value)}/>

              <button type="button" className="filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>{filtersOpen ? 'Hide filters' : 'Filters'}</button>
            </div>

            <div className="toggle" role="group" aria-label="View">
              <button type="button" className={mode === 'grid' ? 'on' : ''} onClick={() => chooseMode('grid')}>Grid</button>
              <button type="button" className={mode === 'list' ? 'on' : ''} onClick={() => chooseMode('list')}>List</button>
            </div>
          </div>

          {loading && <p>Loading</p>}

          {error && <p role="alert">{error}</p>}

          {!loading && !error && entries.length === 0 && <p className="muted">{hasFilters ? 'No entries match these filters' : 'No entries yet'}</p>}

          <ul className={`items ${mode} entry-items`} style={{'--cols': 'minmax(10rem, 1.4fr) 8rem minmax(0, 2fr) 6rem 7rem'}}>
            {mode === 'list' && entries.length > 0 && (
              <li className="list-head" aria-hidden="true">
                <span>Name</span>
                <span>Type</span>
                <span>Tags</span>
                <span>Relations</span>
                <span>Updated</span>
              </li>
            )}

            {sorted.map((entry) => (
              <li key={entry.id} className="cell">
                <div className="cell-name"><Link to={`/worlds/${id}/entries/${entry.id}`}>{entry.name}</Link></div>

                <div className="cell-col" data-label="Type"><span className="type-badge">{entry.typeName || 'No type'}</span></div>

                <div className="cell-col" data-label="Tags">
                  {entry.tags.length === 0 && <span className="muted">None</span>}
                  {entry.tags.length > 0 && <span className="tag-wrap">{entry.tags.map((tag) => <span key={tag.id} className="tag-pill"><TagSwatch color={tag.color}/>{tag.name}</span>)}</span>}
                </div>

                <div className="cell-col" data-label="Relations">{entry.relationshipCount}</div>

                <div className="cell-col" data-label="Updated">{new Date(entry.updatedAt).toLocaleDateString()}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Page>
  );
}
