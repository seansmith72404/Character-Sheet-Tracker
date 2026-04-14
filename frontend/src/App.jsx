import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Landing from './pages/Landing';
import AuthLayout from './styles/AuthLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Lobby from './pages/Lobby';
import Dashboard from './pages/Dashboard'; 
import CharacterCreation from './pages/CharacterCreation';

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
        {/* WILL BE A LOGGED IN LAYOUT */}  
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/lobby/:roomId" element={<Lobby />} />
        <Route path="/character-creation" element={<CharacterCreation />} />
      </Routes>
    </Router>
  );
}

export default App;