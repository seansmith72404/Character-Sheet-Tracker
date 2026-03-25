import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Connect to the backend outside the component so it doesn't reconnect repeatedly
const socket = io('http://localhost:3000');

function Lobby() {
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [activityLog, setActivityLog] = useState([]);

  useEffect(() => {
    // Listen for the server successfully creating the room
    socket.on('lobby_created', (code) => {
      setRoomCode(code);
      setActivityLog((prev) => [...prev, `You created lobby: ${code}`]);
    });

    // Listen for anyone joining the room
    socket.on('room_update', (message) => {
      setActivityLog((prev) => [...prev, message]);
    });

    // Cleanup listeners if the player leaves the page
    return () => {
      socket.off('lobby_created');
      socket.off('room_update');
    };
  }, []);

  const handleCreateLobby = () => {
    socket.emit('create_lobby');
  };

  const handleJoinLobby = () => {
    if (joinInput.trim()) {
      const code = joinInput.toUpperCase();
      socket.emit('join_lobby', code);
      setRoomCode(code);
      setActivityLog((prev) => [...prev, `You joined lobby: ${code}`]);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Character Sheet Lobby</h2>
      
      {/* Show Create/Join buttons if they aren't in a room yet */}
      {!roomCode ? (
        <div>
          <button onClick={handleCreateLobby} style={{ padding: '10px', marginBottom: '20px' }}>
            Create New Lobby
          </button>
          
          <div style={{ marginTop: '20px' }}>
            <p>Or join an existing one:</p>
            <input 
              type="text" 
              placeholder="Enter 5-letter code" 
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              style={{ padding: '10px' }}
            />
            <button onClick={handleJoinLobby} style={{ padding: '10px', marginLeft: '10px' }}>
              Join Lobby
            </button>
          </div>
        </div>
      ) : (
        /* Show the Room Dashboard if they are in a room */
        <div>
          <h3>Current Room: <span style={{ color: 'blue' }}>{roomCode}</span></h3>
          <p>Share this code with your group!</p>
          
          <div style={{ marginTop: '30px', border: '1px solid #ccc', padding: '15px' }}>
            <h4>Room Activity:</h4>
            {activityLog.map((msg, idx) => (
              <p key={idx}>💬 {msg}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Lobby;