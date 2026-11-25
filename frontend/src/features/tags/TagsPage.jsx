import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listEntriesRequest } from '../../api/entries';
import { listEntryTypesRequest } from '../../api/entryTypes';
import { listRelationshipTypesRequest } from '../../api/relationshipTypes';
import { createTagRequest, getTagRuleRequest, listTagsRequest, saveTagRuleRequest } from '../../api/tags';
import { ruleBadges } from '../../utils/tagRules';
import { getWorldRequest } from '../../api/worlds';
import ItemGrid from '../../components/ItemGrid';
import Page from '../../components/Page';
import TagCell from '../../components/TagCell';
import TagForm from '../../components/TagForm';

export default function TagsPage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusTagId = searchParams.get('tag') || '';
  const focusEntryId = searchParams.get('entry') || '';

  const [world, setWorld] = useState(null);
  const [tags, setTags] = useState([]);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [badges, setBadges] = useState({});

  async function loadBadges(tagData) {
    const ruled = tagData.filter((tag) => tag.hasRule);

    if (ruled.length === 0) {
      setBadges({});

      return;
    }

    const [rules, entryTypes, relationshipTypes, entries] = await Promise.all([
      Promise.all(ruled.map((tag) => getTagRuleRequest(id, tag.id))),
      listEntryTypesRequest(id),
      listRelationshipTypesRequest(id),
      listEntriesRequest(id),
    ]);
    const next = {};

    ruled.forEach((tag, index) => {
      next[tag.id] = ruleBadges(rules[index], entryTypes, relationshipTypes, entries);
    });

    setBadges(next);
  }

  useEffect(() => {
    Promise.all([getWorldRequest(id), listTagsRequest(id)])
      .then(([worldData, tagData]) => {
        setWorld(worldData);
        setTags(tagData);
        loadBadges(tagData).catch(() => setBadges({}));
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  async function reload() {
    const tagData = await listTagsRequest(id);

    setTags(tagData);
    loadBadges(tagData).catch(() => setBadges({}));
  }

  async function handleCreate(data, rule) {
    const created = await createTagRequest(id, data);

    if (rule) {
      await saveTagRuleRequest(id, created.id, rule);
    }

    setAdding(false);
    await reload();
  }

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';

  const addForm = <TagForm worldId={id} withRule={true} initial={{name: '', color: null}} submitLabel="Add tag" onSubmit={handleCreate} onCancel={() => setAdding(false)}/>;

  const shown = tags.filter((tag) => tag.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Page size="medium" crumbs={[{to: `/worlds/${id}`, label: world.name}, {label: 'Tags'}]}>
      <ItemGrid title="Tags" nameLabel="Tag" columns={[{label: 'Rule', width: 'minmax(0, 3fr)'}, {label: 'Entries', width: '4.5rem'}]} query={query} onQuery={setQuery} searchLabel="Search tags" storageKey="view-tags" canEdit={canEdit} newLabel="New tag" adding={adding} onNew={() => setAdding(true)} addForm={addForm} empty={shown.length === 0} emptyText="No tags yet">
        {shown.map((tag) => <TagCell key={tag.id} badges={badges[tag.id]} worldId={id} tag={tag} canEdit={canEdit} focus={tag.id === focusTagId} focusEntryId={tag.id === focusTagId ? focusEntryId : ''} onChanged={reload}/>)}
      </ItemGrid>
    </Page>
  );
} 
