import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { forumsAPI } from '../services/api';
import '../styles/game-category.css';

export default function GameCategoryPage() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [forums, setForums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const decodedTag = useMemo(() => decodeURIComponent(tag || ''), [tag]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [forumsResponse, gamesResponse] = await Promise.all([
          forumsAPI.getForums(),
          forumsAPI.getGames()
        ]);
        setForums(forumsResponse.data.data);
        setGames(gamesResponse.data.data);
      } catch (err) {
        setError('Failed to load games');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const forumByGame = forums.reduce((acc, forum) => {
    if (!acc[forum.game_id]) {
      acc[forum.game_id] = forum;
    }
    return acc;
  }, {});

  const filteredGames = games
    .filter((game) => game.name !== 'Community')
    .filter((game) => Array.isArray(game.tags) && game.tags.includes(decodedTag))
    .filter((game) => forumByGame[game.id]);

  if (loading) return <div className="container"><p>Loading games...</p></div>;
  if (error) return <div className="container"><p className="error-message">{error}</p></div>;

  return (
    <div className="container">
      <div className="category-header">
        <button className="back-btn" onClick={() => navigate('/')}>Back</button>
        <div className="category-title">
          <h2>{decodedTag}</h2>
          <p>{filteredGames.length} game{filteredGames.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      {filteredGames.length === 0 ? (
        <div className="category-empty">
          <p>No games tagged with "{decodedTag}" yet.</p>
        </div>
      ) : (
        <div className="category-grid">
          {filteredGames.map((game) => {
            const forum = forumByGame[game.id];
            return (
              <div
                key={game.id}
                className="category-card"
                onClick={() => forum && navigate(`/forums/${forum.id}`)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && forum) {
                    navigate(`/forums/${forum.id}`);
                  }
                }}
              >
                <div className="category-card-header">
                  <h3>{game.name}</h3>
                  {game.tags?.length ? (
                    <div className="tag-row">
                      {game.tags.slice(0, 4).map((item) => (
                        <span key={item} className="tag-pill">{item}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p>{game.description || 'No description yet.'}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
