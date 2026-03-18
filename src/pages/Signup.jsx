import { useState } from "react";
import { Link } from "react-router-dom";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      // 1. Send data to YOUR local server instead of Supabase
      const response = await fetch("http://localhost:3000/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      // 2. Handle the result from your server
      if (response.ok) {
        setMessage("Success! Account created in Neon database.");
        console.log("User created:", data);
      } else {
        setMessage(`Error: ${data.error || "Registration failed"}`);
      }
    } catch (error) {
      console.error("Signup error:", error);
      setMessage("Error: Could not connect to the server.");
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="card w-full max-w-md shadow-xl bg-base-100">
          <div className="card-body p-8 space-y-4">
            <h2 className="text-lg font-bold text-center">Create Account</h2>
            {/*handle the actual sign-up part*/}
            <form onSubmit={handleSignup} className="space-y-4">
              {/* email address */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Email</span>
                </label>
                <input
                  type="email"
                  placeholder="yourEmail@email.com"
                  className="input input-bordered"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {/* password */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Password</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="input input-bordered"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {/* submit button */}
              <button className="btn btn-primary w-full">
                Sign Up
              </button>
            </form>
            {/* divider */}
            <div className="divider">OR</div>
            {/* link to login page */}
            <p className="text-center">
              Already have an account?{" "}
              <Link to="/login" className="link text-primary">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
    /*
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
    */
  );
}

export default Signup;
