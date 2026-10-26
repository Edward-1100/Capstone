import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import WorldsPage from './features/worlds/WorldsPage';
import NewWorldPage from './features/worlds/NewWorldPage';
import WorldPage from './features/worlds/WorldPage';
import EditWorldPage from './features/worlds/EditWorldPage';
import EntryTypesPage from './features/entry-types/EntryTypesPage';
import EntriesPage from './features/entries/EntriesPage';
import NewEntryPage from './features/entries/NewEntryPage';
import EntryPage from './features/entries/EntryPage';
import EditEntryPage from './features/entries/EditEntryPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage/>}/>

      <Route path="/register" element={<RegisterPage/>}/>

      <Route path="/" element={<ProtectedRoute><WorldsPage/></ProtectedRoute>}/>

      <Route path="/worlds/new" element={<ProtectedRoute><NewWorldPage/></ProtectedRoute>}/>

      <Route path="/worlds/:id" element={<WorldPage/>}/>

      <Route path="/worlds/:id/edit" element={<ProtectedRoute><EditWorldPage/></ProtectedRoute>}/>

      <Route path="/worlds/:id/types" element={<EntryTypesPage/>}/>

      <Route path="/worlds/:id/entries" element={<EntriesPage/>}/>

      <Route path="/worlds/:id/entries/new" element={<ProtectedRoute><NewEntryPage/></ProtectedRoute>}/>

      <Route path="/worlds/:id/entries/:entryId" element={<EntryPage/>}/>

      <Route path="/worlds/:id/entries/:entryId/edit" element={<ProtectedRoute><EditEntryPage/></ProtectedRoute>}/>

      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  );
}
