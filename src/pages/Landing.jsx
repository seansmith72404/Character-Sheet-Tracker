import { Link } from "react-router-dom";

function Landing() {
  return (
    <div
      className="hero min-h-screen"
      style={{
        backgroundImage:
          "url(https://preview.redd.it/medieval-city-by-a-rocha-1920x1080-v0-da8nwcnc8ox31.png?width=1080&crop=smart&auto=webp&s=5ce06a7f51aede2c5fc01b1a6554922f556eb282)",
      }}
    >
      <div className="hero-overlay"></div>
      <div className="hero-content text-neutral-content text-center ">
        <div className="">
          <h1 className="mb-5 text-7xl font-bold">WELCOME TO YOUR LAIR</h1>
          <p className="mb-5 text-lg">
            Create your next character or plan your next campaign with LAIRMASTER!
          </p>
          <Link to="/login" className="btn btn-lg bg-white text-black btn-primary mx-3">Log In</Link>
          <Link to="/signup" className="btn btn-lg btn-primary mx-3">Sign Up</Link>
        </div>
      </div>
    </div>
  );
}

export default Landing;