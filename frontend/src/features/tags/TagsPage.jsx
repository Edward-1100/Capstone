import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createTagRequest, listTagsRequest } from '../../api/tags';
import { getWorldRequest } from '../../api/worlds';
import ItemGrid from '../../components/ItemGrid';
import Page from '../../components/Page';
import TagCell from '../../components/TagCell';
import TagForm from '../../components/TagForm';

export default function TagsPage() {
  const {id} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);
  const [tags, setTags] = useState([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([getWorldRequest(id), listTagsRequest(id)])
      .then(([worldData, tagData]) => {
        setWorld(worldData);
        setTags(tagData);
      })
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  async function reload() {
    setTags(await listTagsRequest(id));
  }

  async function handleCreate(data) {
    await createTagRequest(id, data);
    setAdding(false);
    await reload();
  }

  if (!world) {
    return <Page><p>Loading</p></Page>;
  }

  const canEdit = world.role === 'owner' || world.role === 'editor';

  const addForm = <TagForm initial={{name: '', color: null}} submitLabel="Add tag" onSubmit={handleCreate} onCancel={() => setAdding(false)}/>;

  return (
    <Page crumbs={[{to: `/worlds/${id}`, label: world.name}, {label: 'Tags'}]}>
      <ItemGrid storageKey="view-tags" canEdit={canEdit} newLabel="New tag" adding={adding} onNew={() => setAdding(true)} addForm={addForm} empty={tags.length === 0} emptyText="No tags yet">
        {tags.map((tag) => <TagCell key={tag.id} worldId={id} tag={tag} canEdit={canEdit} onChanged={reload}/>)}
      </ItemGrid>
    </Page>
  );
}
