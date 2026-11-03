import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listEntriesRequest } from '../../api/entries';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { listTagsRequest } from '../../api/tags';
import { getWorldRequest } from '../../api/worlds';
import Page from '../../components/Page';
import TagSwatch from '../../components/TagSwatch';

function splitList(value) {
  return value ? value.split(',').filter((item) => item !== '') : [];
}

export default function EntriesPage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = searchParams.get('type') || '';
  const tagsParam = searchParams.get('tags') || '';
  const notParam = searchParams.get('not') || '';
  const matchParam = searchParams.get('match') === 'any' ? 'any' : 'all';

  const [world, setWorld] = useState(null);
  const [types, setTypes] = useState([]);
  const [tags, setTags] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getWorldRequest(id), listEntryTypesRequest(id), listTagsRequest(id)])
      .then(([worldData, typeData, tagData]) => {
        setWorld(worldData);
        setTypes(typeData);
        setTags(tagData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  useEffect(() => {
    listEntriesRequest(id, {typeId: typeFilter, tags: splitList(tagsParam), excludeTags: splitList(notParam), tagMode: matchParam})
      .then((data) => {
        setEntries(data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, typeFilter, tagsParam, notParam, matchParam]);

  const included = splitList(tagsParam);
  const excluded = splitList(notParam);
  const hasFilters = typeFilter !== '' || included.length > 0 || excluded.length > 0;

  function updateParams(changes) {
    const merged = Object.assign({type: typeFilter, tags: tagsParam, not: notParam, match: matchParam === 'any' ? 'any' : ''}, changes);
    const params = {};

    for (const key of Object.keys(merged)) {
      if (merged[key]) {
        params[key] = merged[key];
      }
    }

    setSearchParams(params);
  }

  function tagState(tagId) {
    if (included.includes(tagId)) {
      return 'has';
    }

    return excluded.includes(tagId) ? 'not' : '';
  }

  function handleTagClick(tagId) {
    const state = tagState(tagId);
    const next = state === '' ? 'has' : (state === 'has' ? 'not' : '');
    const nextIncluded = included.filter((item) => item !== tagId);
    const nextExcluded = excluded.filter((item) => item !== tagId);

    if (next === 'has') {
      nextIncluded.push(tagId);
    }

    if (next === 'not') {
      nextExcluded.push(tagId);
    }

    updateParams({tags: nextIncluded.join(','), not: nextExcluded.join(',')});
  }

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';
  const newLink = typeFilter && typeFilter !== 'none' ? `/worlds/${id}/entries/new?type=${typeFilter}` : `/worlds/${id}/entries/new`;

  return (
    <Page size="medium" crumbs={[{to: `/worlds/${id}`, label: world.name}, {label: 'Entries'}]}>
      <div className="panel">
        <div className="toolbar">
          <div className="line">
            <label htmlFor="typeFilter">Show</label>

            <select id="typeFilter" value={typeFilter} onChange={(e) => updateParams({type: e.target.value})}>
              <option value="">All entries</option>
              <option value="none">No type</option>
              {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>

            {hasFilters && <button type="button" onClick={() => setSearchParams({})}>Clear filters</button>}
          </div>

          {canEdit && <Link className="button" to={newLink}>New entry</Link>}
        </div>

        {tags.length > 0 && (
          <div>
            <h2>Tags</h2>

            <div className="tag-filter">
              {tags.map((tag) => {
                const state = tagState(tag.id);

                return (
                  <button key={tag.id} type="button" className={state} aria-pressed={state !== ''} onClick={() => handleTagClick(tag.id)}>
                    {state === 'has' && '+ '}{state === 'not' && '- '}<TagSwatch color={tag.color}/>{tag.name}
                  </button>
                );
              })}
            </div>

            {included.length > 1 && (
              <div className="line">
                <label htmlFor="tagMatch">Entries must have</label>

                <select id="tagMatch" value={matchParam} onChange={(e) => updateParams({match: e.target.value === 'any' ? 'any' : ''})}>
                  <option value="all">All of the required tags</option>
                  <option value="any">Any of the required tags</option>
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
