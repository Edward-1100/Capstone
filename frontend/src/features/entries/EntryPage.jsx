import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getWorldRequest } from '../../api/worlds';
import EntryView from '../../components/EntryView';
import Page from '../../components/Page';

export default function EntryPage() {
  const {id, entryId} = useParams();
  const navigate = useNavigate();

  const [world, setWorld] = useState(null);

  useEffect(() => {
    getWorldRequest(id)
      .then(setWorld)
      .catch((err) => navigate(err.status === 401 ? '/login' : '/', {replace: true}));
  }, [id, navigate]);

  if (!world) {
    return <Page theme="dark"><p>Loading</p></Page>;
  }

  return (
    <Page size="entry" theme="dark" crumbs={[{to: `/worlds/${id}`, label: world.name}, {to: `/worlds/${id}/entries`, label: 'Entries'}]}>
      <EntryView key={entryId} worldId={id} entryId={entryId} role={world.role} sideNotes onDeleted={() => navigate(`/worlds/${id}/entries`, {replace: true})}/>
    </Page>
  );
}
