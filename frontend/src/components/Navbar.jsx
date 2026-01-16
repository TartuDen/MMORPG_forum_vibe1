import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import '../styles/navbar.css';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <h1 onClick={() => navigate('/')}>🎮 MMO Forum</h1>
        </div>

        <div className="navbar-menu">
          {isAuthenticated ? (
            <>
              <span className="navbar-user">Welcome, {user?.username}!</span>
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
