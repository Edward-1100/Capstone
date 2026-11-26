import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { joinByLinkRequest } from '../../api/members';
import Page from '../../components/Page';

export default function JoinPage() {
  const {token} = useParams();
  const navigate = useNavigate();

  const [error, setError] = useState('');

  useEffect(() => {
    joinByLinkRequest(token)
      .then((data) => navigate(data.pendingRole ? '/' : `/worlds/${data.worldId}`, {replace: true}))
      .catch((err) => setError(err.message));
  }, [token, navigate]);

  return (
    <Page size="narrow">
      <h1 className="title page-title">Join world</h1>

      <section className="card">
        {!error && <p>Loading</p>}

        {error && <p role="alert">{error}</p>}

        {error && <p><Link to="/">Back to your worlds</Link></p>}
      </section>
    </Page>
  );
}
