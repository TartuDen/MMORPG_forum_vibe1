import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forumsAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import '../styles/home.css';

export default function HomePage() {
  const [forums, setForums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchForums = async () => {
      try {
        const response = await forumsAPI.getForums();
        setForums(response.data.data);
      } catch (err) {
        setError('Failed to load forums');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchForums();
  }, []);

  if (loading) return <div className="container"><p>Loading forums...</p></div>;
  if (error) return <div className="container"><p className="error-message">{error}</p></div>;

  return (
    <div className="container">
      <div className="home-header">
        <div className="header-content">
          <h2>Game Forums</h2>
          <p>Choose a forum to discuss your favorite MMO/RPG games</p>
        </div>
        {isAuthenticated && (
          <button className="create-forum-btn" onClick={() => navigate('/create-forum')}>
            + Create Forum
          </button>
        )}
      </div>

      {forums.length === 0 ? (
        <div className="no-content">
          <p>No forums available yet</p>
          {isAuthenticated && (
            <button className="create-btn-alt" onClick={() => navigate('/create-forum')}>
              Be the first to create a forum!
            </button>
          )}
        </div>
      ) : (
        <div className="forums-grid">
          {forums.map((forum) => (
            <div
              key={forum.id}
              className="forum-card"
              onClick={() => navigate(`/forums/${forum.id}`)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter') navigate(`/forums/${forum.id}`);
              }}
            >
              <h3>{forum.name}</h3>
              <p>{forum.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
