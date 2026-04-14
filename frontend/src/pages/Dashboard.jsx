// import { BrowserRouter as Link } from 'react-router-dom';
import { Link } from "react-router-dom";

// function Dashboard() {

// }

function Dashboard() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>LAIRMASTER Dashboard</h1>
      <p>Welcome to your campaign hub! Select an option below to get started.</p>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '20px', 
        marginTop: '40px' 
      }}>
        {/* Multiplayer Session Block */}
        <div style={{ 
          padding: '20px', 
          border: '1px solid #ccc', 
          borderRadius: '8px',
          width: '100%',
          maxWidth: '350px'
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
              marginTop: '10px',
              display: 'block',
              width: '100%'
            }}>
              Enter Lobby Hub
            </button>
          </Link>
        </div>
        
        {/* Character Creator Block */}
        <div style={{ 
          padding: '20px', 
          border: '1px solid #ccc', 
          borderRadius: '8px', 
          width: '100%',
          maxWidth: '350px'
        }}>
          <h2>Characters</h2>
          <p>Create or manage your custom character sheets.</p>

          <Link to="/character-creation">
            <button style={{ 
              padding: '10px 20px', 
              fontSize: '16px', 
              cursor: 'pointer',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              marginTop: '10px',
              display: 'block',
              width: '100%'
            }}>
              Character Creator
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;