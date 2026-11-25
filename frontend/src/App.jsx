import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import WorldsPage from './features/worlds/WorldsPage';
import WorldPage from './features/worlds/WorldPage';
import EditWorldPage from './features/worlds/EditWorldPage';
import EntryTypesPage from './features/entry-types/EntryTypesPage';
import RelationshipTypesPage from './features/relationship-types/RelationshipTypesPage';
import TagsPage from './features/tags/TagsPage';
import EntriesPage from './features/entries/EntriesPage';
import NewEntryPage from './features/entries/NewEntryPage';
import EntryPage from './features/entries/EntryPage';
import BlockedUsersPage from './features/members/BlockedUsersPage';
import JoinPage from './features/members/JoinPage';
import MapPage from './features/maps/MapPage';
import GraphPage from './features/graph/GraphPage';
import TimelinePage from './features/timeline/TimelinePage';
import EasterEgg from './components/EasterEgg';
import { applyTheme, getTheme } from './utils/theme';

export default function App() {
  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage/>}/>

        <Route path="/register" element={<RegisterPage/>}/>

        <Route path="/" element={<ProtectedRoute><WorldsPage/></ProtectedRoute>}/>

        <Route path="/worlds/:id" element={<WorldPage/>}/>

        <Route path="/worlds/:id/edit" element={<ProtectedRoute><EditWorldPage/></ProtectedRoute>}/>

        <Route path="/worlds/:id/types" element={<EntryTypesPage/>}/>

        <Route path="/worlds/:id/relationship-types" element={<RelationshipTypesPage/>}/>

        <Route path="/worlds/:id/tags" element={<TagsPage/>}/>

        <Route path="/worlds/:id/maps" element={<MapPage/>}/>

        <Route path="/worlds/:id/maps/:mapId" element={<MapPage/>}/>

        <Route path="/worlds/:id/graph" element={<GraphPage/>}/>

        <Route path="/worlds/:id/timeline" element={<TimelinePage/>}/>
        
        <Route path="/worlds/:id/entries" element={<EntriesPage/>}/>

        <Route path="/worlds/:id/entries/new" element={<ProtectedRoute><NewEntryPage/></ProtectedRoute>}/>

        <Route path="/worlds/:id/entries/:entryId" element={<EntryPage/>}/>

        <Route path="/blocked" element={<ProtectedRoute><BlockedUsersPage/></ProtectedRoute>}/>

        <Route path="/join/:token" element={<ProtectedRoute><JoinPage/></ProtectedRoute>}/>

        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>

      <EasterEgg/>
    </>
  );
}
