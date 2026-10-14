import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import test from '../../assets/test.png';

export default function HomePage() {
  const {user, logout} = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', {replace: true});
  }

  return (
    <div>
      <h1>Home <img width="67" src={test} alt="Test"/></h1>

      <p>Logged in as {user.username} ({user.email})</p>

      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}
