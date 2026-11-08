import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Page from '../../components/Page';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const {register} = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await register(email, username, password);
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
        <h1 className="title">Register</h1>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required/>
          </div>

          <div>
            <label htmlFor="username">Username</label>
            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={45} required/>
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} maxLength={72} required/>
          </div>

          {error && <p role="alert">{error}</p>}

          <div className="actions">
            <button type="submit" disabled={submitting}>Register</button>
          </div>
        </form>

        <p>Already have an account? <Link to="/login" state={location.state}>Log in</Link></p>
      </div>
    </Page>
  );
}
