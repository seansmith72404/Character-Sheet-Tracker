import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function CharacterCreation() {
  const navigate = useNavigate();
  const [characterName, setCharacterName] = useState('');
  const [gameSystem, setGameSystem] = useState(''); // New state for the dropdown
  
  // Rigid stats for the math engine
  const [coreStats, setCoreStats] = useState({
    STR: '', DEX: '', CON: '', INT: '', WIS: '', CHA: '', Speed: '', MaxHP: ''
  });

  // Dynamic fields for extra fluff
  const [fieldCount, setFieldCount] = useState(3);
  const [customFields, setCustomFields] = useState(Array(3).fill({ name: '', value: '' }));
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
        navigate('/');
    }
  }, [navigate]);

  const handleCoreStatChange = (stat, value) => {
    setCoreStats(prev => ({ ...prev, [stat]: value }));
  };

  const handleFieldCountChange = (e) => {
    let newCount = parseInt(e.target.value, 10);
    if (isNaN(newCount) || newCount < 0) newCount = 0;
    
    setFieldCount(newCount);
    
    if (newCount > customFields.length) {
      const newFields = Array(newCount - customFields.length).fill({ name: '', value: '' });
      setCustomFields([...customFields, ...newFields]);
    } else if (newCount < customFields.length) {
      setCustomFields(customFields.slice(0, newCount));
    }
  };

  const handleCustomFieldChange = (index, key, value) => {
    const newFields = [...customFields];
    newFields[index] = { ...newFields[index], [key]: value };
    setCustomFields(newFields);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!gameSystem) {
        setError("You must select a Game System.");
        setIsSubmitting(false);
        return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Clean up the payload
      let finalCoreStats = {};
      if (gameSystem === 'DND5E') {
          finalCoreStats = {
              STR: parseInt(coreStats.STR) || 0,
              DEX: parseInt(coreStats.DEX) || 0,
              CON: parseInt(coreStats.CON) || 0,
              INT: parseInt(coreStats.INT) || 0,
              WIS: parseInt(coreStats.WIS) || 0,
              CHA: parseInt(coreStats.CHA) || 0,
              Speed: parseInt(coreStats.Speed) || 0,
              MaxHP: parseInt(coreStats.MaxHP) || 0,
          };
      }

      // Convert custom fields array into a single JSON object for the database
      const finalCustomFields = customFields.reduce((acc, field) => {
          if (field.name.trim() !== '') {
              acc[field.name.trim()] = field.value;
          }
          return acc;
      }, {});

      const res = await fetch('http://localhost:3000/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: characterName,
          game_system: gameSystem,
          core_stats: finalCoreStats,
          custom_fields: finalCustomFields
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save character');
      }

      // Send them to the dashboard instead of the lobby so they can see their roster later
      navigate('/dashboard'); 
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8 flex justify-center items-start">
      <div className="card w-full max-w-5xl bg-base-100 shadow-xl mt-10 border border-base-300">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6 border-b border-base-300 pb-4">
             <h2 className="card-title text-3xl text-primary font-bold tracking-tight">
               Character Creator
             </h2>
             <button onClick={() => navigate('/dashboard')} className="btn btn-outline btn-sm">
                Cancel
             </button>
          </div>
          
          {error && <div className="alert alert-error mb-4 shadow-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Top Row: Name and System */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="form-control flex-grow">
                <label className="label">
                  <span className="label-text font-bold text-lg">Character Name</span>
                </label>
                <input
                  type="text"
                  placeholder="E.g., Aragorn..."
                  required
                  className="input input-bordered w-full input-lg focus:input-primary shadow-sm"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                />
              </div>

              <div className="form-control w-full md:w-1/3">
                <label className="label">
                  <span className="label-text font-bold text-lg">Game System</span>
                </label>
                <select 
                    className="select select-bordered select-lg w-full shadow-sm"
                    value={gameSystem}
                    onChange={(e) => setGameSystem(e.target.value)}
                    required
                >
                  <option value="" disabled>Select System</option>
                  <option value="DND5E">Dungeons & Dragons 5e</option>
                  <option value="CUSTOM">Custom / Other</option>
                </select>
              </div>
            </div>

            {/* D&D 5e Rigid Stats Grid (Only shows if DND5E is selected) */}
            {gameSystem === 'DND5E' && (
                <div className="bg-base-200 p-6 rounded-box shadow-inner border border-base-300">
                    <h3 className="font-bold text-lg mb-4">Core Combat Stats (Required for VTT)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.keys(coreStats).map((stat) => (
                            <div key={stat} className="form-control">
                                <label className="label py-1">
                                    <span className="label-text font-semibold">{stat}</span>
                                </label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="input input-bordered w-full shadow-sm"
                                    value={coreStats[stat]}
                                    onChange={(e) => handleCoreStatChange(stat, e.target.value)}
                                    required
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="divider text-base-content/50 font-semibold tracking-widest text-sm uppercase">Custom Attributes</div>

            {/* Dynamic Custom Fields Section */}
            <div>
                <div className="form-control w-full md:w-48 mb-4">
                    <label className="label">
                    <span className="label-text font-bold text-sm">Number of Custom Fields</span>
                    </label>
                    <input
                    type="number"
                    min="0"
                    max="50"
                    className="input input-bordered w-full font-mono text-center shadow-sm"
                    value={fieldCount}
                    onChange={handleFieldCountChange}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-base-200/50 p-6 rounded-box shadow-inner min-h-[12rem]">
                {customFields.map((field, index) => (
                    <div key={index} className="flex gap-3 items-center bg-base-100 p-2 sm:p-4 rounded-xl border border-base-300 shadow-sm transition-all hover:border-primary/30 group">
                    <div className="badge badge-primary badge-outline font-mono font-bold shadow-sm group-hover:bg-primary group-hover:text-primary-content transition-colors">
                        {index + 1}
                    </div>
                    <input
                        type="text"
                        placeholder="Field (e.g. Gold)"
                        className="input input-bordered flex-1 sm:input-md font-semibold transition-all focus:border-primary shadow-sm"
                        value={field.name}
                        onChange={(e) => handleCustomFieldChange(index, 'name', e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Value (e.g. 500)"
                        className="input input-bordered flex-1 sm:input-md transition-all focus:border-primary shadow-sm"
                        value={field.value}
                        onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                    />
                    </div>
                ))}
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-base-300 flex justify-end">
              <button 
                type="submit" 
                className={`btn btn-primary btn-lg shadow-lg hover:shadow-xl transition-all w-full md:w-auto px-12 ${isSubmitting ? 'loading' : ''}`}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Character'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}

export default CharacterCreation;