import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function CharacterCreation() {
  const navigate = useNavigate();
  const [characterName, setCharacterName] = useState('');
  const [fieldCount, setFieldCount] = useState(5);
  const [fields, setFields] = useState(Array(5).fill({ name: '', value: '' }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
        navigate('/');
    }
  }, [navigate]);

  const handleFieldCountChange = (e) => {
    let newCount = parseInt(e.target.value, 10);
    if (isNaN(newCount) || newCount < 0) {
      newCount = 0;
    }
    setFieldCount(newCount);
    
    // Resize the array preserving existing values
    if (newCount > fields.length) {
      const newFields = Array(newCount - fields.length).fill({ name: '', value: '' });
      setFields([...fields, ...newFields]);
    } else if (newCount < fields.length) {
      setFields(fields.slice(0, newCount));
    }
  };

  const handleFieldChange = (index, key, value) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFields(newFields);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: characterName,
          fields: fields.filter(f => f.name.trim() !== '' || f.value.trim() !== '')
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save character');
      }

      navigate('/lobby');
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
             <h2 className="card-title text-3xl text-primary drop-shadow-sm font-bold tracking-tight">
               Character Creator
             </h2>
             <button onClick={() => navigate('/lobby')} className="btn btn-outline btn-sm">
                Cancel
             </button>
          </div>
          
          {error && <div className="alert alert-error mb-4 shadow-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="form-control flex-grow transition-all">
                <label className="label">
                  <span className="label-text font-bold text-lg">Character Name</span>
                </label>
                <input
                  type="text"
                  placeholder="E.g., Aragorn, Gandalf..."
                  required
                  className="input input-bordered w-full input-lg focus:input-primary shadow-sm"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                />
              </div>

              <div className="form-control w-full md:w-64">
                <label className="label">
                  <span className="label-text font-bold text-lg">Number of Fields</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="input input-bordered w-full input-lg font-mono text-center shadow-sm"
                  value={fieldCount}
                  onChange={handleFieldCountChange}
                />
              </div>
            </div>

            <div className="divider text-base-content/50 font-semibold tracking-widest text-sm uppercase">Custom Attributes</div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-base-200/50 p-6 rounded-box shadow-inner min-h-[16rem]">
              {fields.map((field, index) => (
                <div key={index} className="flex gap-3 items-center bg-base-100 p-2 sm:p-4 rounded-xl border border-base-300 shadow-sm transition-all hover:shadow-md hover:border-primary/30 group">
                  <div className="badge badge-primary badge-outline font-mono font-bold shadow-sm group-hover:bg-primary group-hover:text-primary-content transition-colors">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    placeholder="Field Name (e.g. STR)"
                    className="input input-bordered flex-1 sm:input-md font-semibold transition-all focus:border-primary shadow-sm"
                    value={field.name}
                    onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 18)"
                    className="input input-bordered flex-1 sm:input-md transition-all focus:border-primary shadow-sm"
                    value={field.value}
                    onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                  />
                </div>
              ))}
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
