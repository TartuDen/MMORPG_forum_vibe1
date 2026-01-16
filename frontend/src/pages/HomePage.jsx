import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forumsAPI } from '../services/api';
import '../styles/home.css';

export default function HomePage() {
  const [forums, setForums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
        <h2>Game Forums</h2>
        <p>Choose a forum to discuss your favorite MMO/RPG games</p>
      </div>

      {forums.length === 0 ? (
        <p className="no-content">No forums available yet</p>
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
