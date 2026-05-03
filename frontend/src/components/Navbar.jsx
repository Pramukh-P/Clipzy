import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        {/* <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="7" fill="url(#navGrad)" />
          <path d="M9 9.5L19 14L9 18.5V9.5Z" fill="white" />
          <defs>
            <linearGradient id="navGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366f1" />
              <stop offset="1" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg> */}
        <img src="./logo1.png" alt="" width={40}/>
        <span>Clipzy</span>
      </Link>

      <div className="nav-links">
        <Link
          to="/"
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
        >
          Home
        </Link>
        <Link
          to="/youtube"
          className={`nav-link ${location.pathname === '/youtube' ? 'active' : ''}`}
        >
          YouTube
        </Link>
        <Link
          to="/instagram"
          className={`nav-link ${location.pathname === '/instagram' ? 'active' : ''}`}
        >
          Instagram
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
