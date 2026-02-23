import { useState } from 'react';
import { Link } from 'react-router-dom';

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      // 1. Send data to YOUR local server instead of Supabase
      const response = await fetch('http://localhost:3000/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      // 2. Handle the result from your server
      if (response.ok) {
        setMessage('Success! Account created in Neon database.');
        console.log("User created:", data);
      } else {
        setMessage(`Error: ${data.error || 'Registration failed'}`);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setMessage('Error: Could not connect to the server.');
    }
  };

  return (
    <div className="auth-container">
      <h2>Create Account</h2>
      <form onSubmit={handleSignup}>
        <div>
          <label>Email:</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
        </div>
        <div>
          <label>Password:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <button type="submit">Sign Up</button>
      </form>
      {message && <p>{message}</p>}
      <p>
        Already have an account? <Link to="/">Login</Link>
      </p>
    </div>
  );
}

export default Signup;