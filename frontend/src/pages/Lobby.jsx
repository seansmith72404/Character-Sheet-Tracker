import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useNavigate, useParams } from 'react-router-dom';

const socket = io('http://localhost:3000', {
  autoConnect: false
});

function Lobby() {
  const { roomId } = useParams(); // Grabs the dynamic code directly from the URL
  const navigate = useNavigate();

  const [joinInput, setJoinInput] = useState('');
  const [activityLog, setActivityLog] = useState([]);
  const [users, setUsers] = useState([]); 
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        navigate('/');
        return;
    }

    // Hard wipe the state arrays whenever the URL changes
    setActivityLog([]);
    setUsers([]);

    socket.auth = { token };
    socket.connect();

    // If a room ID exists in the URL, immediately attempt to join it
    if (roomId) {
        socket.emit('join_lobby', roomId);
    }

    socket.on('lobby_created', (code) => {
      // When the server generates a code, push the browser to that new URL
      navigate(`/lobby/${code}`);
    });

    socket.on('room_update', (message) => {
      setActivityLog((prev) => [...prev, { type: 'system', text: message }]);
    });

    socket.on('room_users_update', (userList) => {
      setUsers(userList);
    });

    socket.on('receive_message', (data) => {
      setActivityLog((prev) => [...prev, { type: 'chat', user: data.username, text: data.text }]);
    });

    socket.on('connect_error', (err) => {
      console.error("Connection failed:", err.message);
      setActivityLog((prev) => [...prev, { type: 'system', text: `Error: ${err.message}` }]);
      
      if (err.message.includes("Authentication error")) {
          localStorage.removeItem('token');
          navigate('/');
      }
    });

    return () => {
      socket.off('lobby_created');
      socket.off('room_update');
      socket.off('room_users_update');
      socket.off('receive_message');
      socket.off('connect_error');
      socket.disconnect(); // Severs the connection entirely when changing pages
    };
  }, [navigate, roomId]); // Adding roomId ensures this runs whenever the URL changes

  const handleCreateLobby = () => {
    socket.emit('create_lobby');
  };

  const handleJoinLobby = () => {
    if (joinInput.trim()) {
      const code = joinInput.toUpperCase();
      // Instead of emitting here, just navigate. The useEffect handles the rest.
      navigate(`/lobby/${code}`);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim() && roomId) {
      socket.emit('send_message', roomId, chatInput.trim());
      setChatInput('');
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8 flex justify-center items-start">
      <div className="card w-full max-w-4xl bg-base-100 shadow-xl mt-10">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">LAIRMASTER Lobby Hub</h2>
          
          {/* Conditionally render based on the URL parameter */}
          {!roomId ? (
            <div className="space-y-8 max-w-xl mx-auto w-full mt-4">
              <div>
                <button onClick={handleCreateLobby} className="btn btn-primary w-full">
                  Create New Lobby
                </button>
              </div>
              
              <div className="divider">OR</div>
              
              <div>
                <p className="mb-2 text-sm font-semibold">Join an existing lobby:</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter 5-letter code" 
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    className="input input-bordered w-full uppercase"
                    maxLength="5"
                  />
                  <button onClick={handleJoinLobby} className="btn btn-secondary">
                    Join Lobby
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-base-200 p-4 rounded-lg border border-base-300">
                <div>
                    <h3 className="text-xl">
                    Current Room: <span className="text-primary font-bold">{roomId}</span>
                    </h3>
                    <p className="text-sm opacity-70">Share this code with your group</p>
                </div>
                <button onClick={() => navigate('/lobby')} className="btn btn-error btn-sm">
                    Leave Lobby
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                
                <div className="md:col-span-1 space-y-4">
                  <h4 className="font-bold border-b border-base-300 pb-2">
                    Party Members ({users.length})
                  </h4>
                  <ul className="space-y-2">
                    {users.map((u) => (
                      <li key={u.id} className="bg-base-200 p-3 rounded-lg flex items-center justify-between border border-base-300 shadow-sm">
                        <span className="font-semibold">{u.username}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="md:col-span-2 bg-base-200 p-4 rounded-box min-h-80 max-h-96 border border-base-300 shadow-inner flex flex-col">
                  <h4 className="font-bold mb-4 border-b border-base-300 pb-2">Room Activity</h4>
                  
                  <div className="space-y-2 flex-grow overflow-y-auto mb-4">
                    {activityLog.map((log, idx) => (
                      <p key={idx} className="text-sm">
                        {log.type === 'system' ? (
                          <span className="opacity-70 italic">💬 {log.text}</span>
                        ) : (
                          <span><strong>{log.user}:</strong> {log.text}</span>
                        )}
                      </p>
                    ))}
                  </div>

                  <form onSubmit={handleSendMessage} className="flex gap-2 mt-auto pt-2 border-t border-base-300">
                    <input 
                      type="text" 
                      placeholder="Type a message..." 
                      className="input input-bordered flex-grow"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary">Send</button>
                  </form>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Lobby;