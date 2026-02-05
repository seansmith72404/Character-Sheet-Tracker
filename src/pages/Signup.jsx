import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient'; // Import the connection

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(''); // For feedback to the user

  const handleSignup = async (e) => {
    e.preventDefault();
    setMessage('');

    // 1. Call Supabase to create the user
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    // 2. Handle the result
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Success! Check your email to confirm your account.');
      // Optional: You can log the data to see what happened
      console.log(data);
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