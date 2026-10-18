import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import WorldsPage from './features/worlds/WorldsPage';
import NewWorldPage from './features/worlds/NewWorldPage';
import WorldPage from './features/worlds/WorldPage';
import EditWorldPage from './features/worlds/EditWorldPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage/>}/>

      <Route path="/register" element={<RegisterPage/>}/>

      <Route path="/" element={<ProtectedRoute><WorldsPage/></ProtectedRoute>}/>

      <Route path="/worlds/new" element={<ProtectedRoute><NewWorldPage/></ProtectedRoute>}/>

      <Route path="/worlds/:id" element={<WorldPage/>}/>

      <Route path="/worlds/:id/edit" element={<ProtectedRoute><EditWorldPage/></ProtectedRoute>}/>

      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  );
}
