import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Lobby from './pages/Lobby'; 

// Create a placeholder Dashboard component
function Dashboard() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Character Sheet Dashboard</h1>
      <p>Welcome to your campaign hub! Select an option below to get started.</p>
      
      <div style={{ 
        marginTop: '40px', 
        padding: '20px', 
        border: '1px solid #ccc', 
        borderRadius: '8px', 
        display: 'inline-block' 
      }}>
        <h2>Multiplayer Session</h2>
        <p>Connect with your party to share live updates.</p>
        
        {/* This Link wraps our button and directs the browser to the Lobby */}
        <Link to="/lobby">
          <button style={{ 
            padding: '10px 20px', 
            fontSize: '16px', 
            cursor: 'pointer',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            marginTop: '10px'
          }}>
            Enter Lobby Hub
          </button>
        </Link>
      </div>
    </div>
  );
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
        <Route path="/lobby" element={<Lobby />} />
      
      </Routes>
    </Router>
  );
}

export default App;