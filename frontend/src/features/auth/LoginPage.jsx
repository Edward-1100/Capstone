import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Page from '../../components/Page';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const {login} = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(location.state?.from ?? '/', {replace: true});
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page size="narrow">
      <div className="panel">
        <h1 className="title">Log in</h1>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required/>
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required/>
          </div>

          {error && <p role="alert">{error}</p>}

          <div className="actions">
            <button type="submit" disabled={submitting}>Log in</button>
          </div>
        </form>

        <p>No account? <Link to="/register" state={location.state}>Register</Link></p>
      </div>
    </Page>
  );
}
