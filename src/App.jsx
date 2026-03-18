import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthLayout from './styles/AuthLayout'
import Login from './pages/Login';
import Signup from './pages/Signup';
import Landing from './pages/Landing';

// Create a placeholder Dashboard component
function Dashboard() {
  return <h1>Character Sheet Dashboard</h1>;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>
        {/* WILL BE A LOGGED IN LAYOUT */}  
        <Route path="/dashboard" element={<Dashboard />} />
      
      </Routes>
    </Router>
  );
}

export default App;