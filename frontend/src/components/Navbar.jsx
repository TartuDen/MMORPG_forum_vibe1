import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import '../styles/navbar.css';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <h1 onClick={() => navigate('/')}>🎮 MMO Forum</h1>
        </div>

        <form className="navbar-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search threads, comments, users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-btn">Search</button>
        </form>

        <div className="navbar-menu">
          {isAuthenticated ? (
            <>
              <span 
                className="navbar-user" 
                onClick={() => navigate(`/user/${user?.id}`)}
                style={{ cursor: 'pointer' }}
              >
                Welcome, {user?.username}!
              </span>
              <button onClick={handleLogout} className="navbar-btn logout-btn">
                Logout
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="navbar-btn login-btn">
                Login
              </button>
              <button onClick={() => navigate('/register')} className="navbar-btn register-btn">
                Register
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
