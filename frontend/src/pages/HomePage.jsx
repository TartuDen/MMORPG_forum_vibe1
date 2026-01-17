import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forumsAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import '../styles/home.css';

export default function HomePage() {
  const [forums, setForums] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  useEffect(() => {
    const fetchForums = async () => {
      try {
        const [forumsResponse, gamesResponse] = await Promise.all([
          forumsAPI.getForums(),
          forumsAPI.getGames()
        ]);
        setForums(forumsResponse.data.data);
        setGames(gamesResponse.data.data);
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

  const forumByGame = forums.reduce((acc, forum) => {
    if (!acc[forum.game_id]) {
      acc[forum.game_id] = forum;
    }
    return acc;
  }, {});

  const communityGame = games.find((game) => game.name === 'Community');
  const generalForum = forums.find(
    (forum) => forum.name === 'General Discussion' && forum.game_name === 'Community'
  );

  return (
    <div className="container">
      <div className="home-header">
        <div className="header-content">
          <h2>Game Forums</h2>
          <p>Choose a forum to discuss your favorite MMO/RPG games</p>
        </div>
        {isAdmin && (
          <button className="create-forum-btn" onClick={() => navigate('/create-forum')}>
            Manage Games
          </button>
        )}
      </div>

      {generalForum && (
        <div className="general-forum-card" onClick={() => navigate(`/forums/${generalForum.id}`)}>
          <div className="general-forum-header">
            <span className="general-forum-label">General Discussion</span>
            {communityGame?.tags?.length ? (
              <div className="tag-row">
                {communityGame.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="tag-pill">{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
          <p>{communityGame?.description || 'Site-wide discussion and announcements.'}</p>
        </div>
      )}

      <div className="games-section">
        <h3>Game Hubs</h3>
        <p className="section-subtitle">Jump into the main forum for each game</p>
        <div className="games-grid">
          {games.filter((game) => game.name !== 'Community').map((game) => {
            const forum = forumByGame[game.id];
            return (
              <div
                key={game.id}
                className="game-card"
                onClick={() => {
                  if (forum) {
                    navigate(`/forums/${forum.id}`);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    if (forum) {
                      navigate(`/forums/${forum.id}`);
                    }
                  }
                }}
              >
                <div className="game-card-header">
                  <h4>{game.name}</h4>
                  {game.tags && game.tags.length > 0 && (
                    <div className="tag-row">
                      {game.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="tag-pill">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <p>{game.description || 'No description yet.'}</p>
                {!forum && (
                  <span className="game-card-hint">
                    No forums yet
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
