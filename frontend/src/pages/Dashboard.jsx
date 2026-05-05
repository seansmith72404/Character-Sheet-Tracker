import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Dashboard() {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCharacters = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/');
        return;
      }

      try {
        const res = await fetch('http://localhost:3000/api/characters', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await res.json();
        if (data.success) {
            setCharacters(data.characters);
        }
      } catch (err) {
        console.error("Failed to fetch characters:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCharacters();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-6xl mx-auto space-y-8 mt-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-center bg-base-100 p-6 rounded-box shadow-sm border border-base-300">
          <div>
            <h1 className="text-3xl font-bold text-primary">LAIRMASTER Dashboard</h1>
            <p className="text-base-content/70 mt-1">Manage your characters and access your active lobbies.</p>
          </div>
          <div className="flex gap-4">
            <Link to="/lobby" className="btn btn-secondary shadow-md">
              Enter Lobby Hub
            </Link>
            <button 
                onClick={() => { localStorage.removeItem('token'); navigate('/'); }} 
                className="btn btn-outline btn-error shadow-md"
            >
                Logout
            </button>
          </div>
        </div>

        {/* Roster Section */}
        <div>
          <div className="flex justify-between items-center mb-4 border-b border-base-300 pb-2">
            <h2 className="text-2xl font-bold">Your Roster</h2>
            {/* Corrected route to match App.jsx */}
            <Link to="/character-creation" className="btn btn-primary btn-sm">
              + New Character
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          ) : characters.length === 0 ? (
            <div className="bg-base-100 p-12 text-center rounded-box border border-base-300 border-dashed">
              <h3 className="text-lg font-semibold text-base-content/60">No characters found.</h3>
              <p className="text-sm text-base-content/50">Roll up a new hero to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map((char) => (
                <div key={char.id} className="card bg-base-100 shadow-xl border border-base-300 hover:border-primary/50 transition-colors">
                  <div className="card-body">
                    <h2 className="card-title text-xl border-b border-base-200 pb-2">{char.character_name}</h2>
                    <div className="flex justify-between items-center mt-2">
                        <span className="badge badge-outline">{char.game_system}</span>
                        {char.game_system === 'DND5E' && char.core_stats && (
                            <span className="text-sm font-semibold opacity-70">
                                HP: {char.core_stats.MaxHP} | DEX: {char.core_stats.DEX}
                            </span>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Dashboard;