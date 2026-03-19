import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Lobby from './pages/Lobby';

function Dashboard() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Character Sheet Dashboard</h1>
      <p>Welcome to your campaign hub! Select an option below to get started.</p>

      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '40px' }}>
        <div style={{ 
          padding: '20px', 
          border: '1px solid #ccc', 
          borderRadius: '8px', 
          minWidth: '300px',
          textAlign: 'center'
        }}>
          <h2>Multiplayer Session</h2>
          <p>Connect with your party to share live updates.</p>
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

        <div style={{ 
          padding: '20px', 
          border: '1px solid #ccc', 
          borderRadius: '8px', 
          minWidth: '300px',
          textAlign: 'center'
        }}>
          <h2>Create Character</h2>
          <p>Create up to 99 custom fields for a character and optionally set initial values.</p>
          <Link to="/create-character">
            <button style={{ 
              padding: '10px 20px', 
              fontSize: '16px', 
              cursor: 'pointer',
              backgroundColor: '#2E86AB',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              marginTop: '10px'
            }}>
              Configure Character Fields
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function CreateCharacterPage() {
  const [fieldCount, setFieldCount] = useState(5);
  const [fields, setFields] = useState(() => Array(99).fill(''));
  const [values, setValues] = useState(() => Array(99).fill(''));
  const [status, setStatus] = useState('');

  const handleFieldChange = (index, v) => {
    const next = [...fields];
    next[index] = v;
    setFields(next);
  };
  const handleValueChange = (index, v) => {
    const next = [...values];
    next[index] = v;
    setValues(next);
  };

    const handleSubmit = async () => {
        const fPayload = {};
        const vPayload = {};
        for (let i = 0; i < fieldCount; i++) {
            const name = fields[i] && fields[i].trim();
            const val = values[i] && values[i].trim();
            if (name) fPayload[`Field${i + 1}`] = name;
            if (val) vPayload[`Value${i + 1}`] = val;
        }

        try {
            setStatus('Requesting new character ID...');
            const createRes = await fetch('http://localhost:3000/api/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}) // empty -> server generates ID
            });
            const createData = await createRes.json();
            if (!createData || !createData.characterId) throw new Error('No characterId returned');
            const cid = String(createData.characterId);

            if (Object.keys(fPayload).length > 0) {
                setStatus('Saving field definitions...');
                await fetch('http://localhost:3000/api/character-fields', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ characterId: cid, fields: fPayload })
                });
            }

            if (Object.keys(vPayload).length > 0) {
                setStatus('Saving field values...');
                await fetch('http://localhost:3000/api/character-values', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ characterId: cid, values: vPayload })
                });
            }

            setStatus('Saved successfully');
            alert(`Character created with ID ${cid} and fields saved.`);
        } catch (err) {
            console.error(err);
            setStatus('Error saving');
            alert('Failed to save character fields/values');
        }
    };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Create Character Fields</h1>
      <p>Define up to 99 custom fields for a character and optionally provide starting values.</p>

      <div style={{ marginTop: '12px' }}>
        <label>Number of fields (1-99): </label>
        <input type="number" min={1} max={99} value={fieldCount} onChange={(e) => setFieldCount(Math.min(99, Math.max(1, Number(e.target.value) || 1)))} style={{ width: '80px', marginLeft: '8px' }} />
      </div>

      <div style={{ marginTop: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ fontWeight: '600' }}>Field Name</div>
          <div style={{ fontWeight: '600' }}>Initial Value (optional)</div>
        </div>

        {Array.from({ length: fieldCount }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <input placeholder={`Field ${i+1} name`} value={fields[i]} onChange={(e) => handleFieldChange(i, e.target.value)} />
            <input placeholder={`Value ${i+1}`} value={values[i]} onChange={(e) => handleValueChange(i, e.target.value)} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '16px' }}>
        <button onClick={handleSubmit} style={{ padding: '10px 16px', backgroundColor: '#2E86AB', color: 'white', border: 'none', borderRadius: '4px' }}>Save Fields</button>
        <Link to="/dashboard" style={{ marginLeft: '12px' }}>
          <button style={{ padding: '10px 16px' }}>Back</button>
        </Link>
      </div>

      <div style={{ marginTop: '12px' }}>{status}</div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create-character" element={<CreateCharacterPage />} />
        <Route path="/lobby" element={<Lobby />} />
      </Routes>
    </Router>
  );
}

export default App;
