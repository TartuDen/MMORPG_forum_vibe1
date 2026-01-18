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
  const [generalThreads, setGeneralThreads] = useState([]);
  const [generalThreadsLoading, setGeneralThreadsLoading] = useState(false);
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
  const gamesWithForums = games
    .filter((game) => game.name !== 'Community')
    .filter((game) => forumByGame[game.id]);
  const tagCounts = gamesWithForums.reduce((acc, game) => {
    if (!Array.isArray(game.tags)) {
      return acc;
    }
    game.tags.forEach((tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});
  const sortedTags = Object.keys(tagCounts)
    .sort((a, b) => {
      const diff = tagCounts[b] - tagCounts[a];
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });

  useEffect(() => {
    if (!generalForum?.id) return;
    let active = true;
    setGeneralThreadsLoading(true);
    forumsAPI.getForum(generalForum.id, 1, 3)
      .then((response) => {
        if (active) {
          setGeneralThreads(response.data.data?.threads || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) {
          setGeneralThreadsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [generalForum?.id]);

  if (loading) return <div className="container"><p>Loading forums...</p></div>;
  if (error) return <div className="container"><p className="error-message">{error}</p></div>;

  return (
    <div className="container">
      <div className="home-header">
        <div className="header-content">
          <h2>Game Forums</h2>
          <p>Choose a forum to discuss your favorite MMO/RPG games</p>
        </div>
        {isAdmin && (
          <button className="create-forum-btn" onClick={() => navigate('/create-forum?mode=manage')}>
            Manage Games
          </button>
        )}
      </div>

      {generalForum && (
        <div
          className="general-forum-card"
          style={communityGame?.icon_url
            ? { backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.8)), url(${communityGame.icon_url})` }
            : undefined}
          onClick={() => navigate(`/forums/${generalForum.id}`)}
        >
          <div className="general-forum-top">
            <div>
              <span className="general-forum-label">General Discussion</span>
              <h3 className="general-forum-title">Community HQ</h3>
              <p className="general-forum-description">
                {communityGame?.description || 'Site-wide discussion and announcements.'}
              </p>
              {communityGame?.tags?.length ? (
                <div className="tag-row">
                  {communityGame.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="tag-pill">{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="general-forum-action"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/forums/${generalForum.id}`);
              }}
            >
              Enter Forum
            </button>
          </div>
          <div className="general-forum-threads">
            <div className="general-forum-threads-header">Latest threads</div>
            {generalThreadsLoading ? (
              <div className="general-thread muted">Loading threads...</div>
            ) : generalThreads.length === 0 ? (
              <div className="general-thread muted">No threads yet. Start the conversation.</div>
            ) : (
              generalThreads.map((thread) => (
                <div key={thread.id} className="general-thread">
                  <div className="general-thread-title">{thread.title}</div>
                  <div className="general-thread-meta">
                    by {thread.author_username} · {thread.comment_count || 0} replies
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {sortedTags.length > 0 && (
        <div className="tag-browse">
          <h3>Browse by Tag</h3>
          <p className="section-subtitle">Pick a category and explore the games</p>
          <div className="tag-chip-row">
            {sortedTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="tag-chip"
                onClick={() => navigate(`/games/category/${encodeURIComponent(tag)}`)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="games-section">
        <h3>All Game Forums</h3>
        <div className="games-grid">
          {gamesWithForums.map((game) => {
            const forum = forumByGame[game.id];
            return (
              <div
                key={game.id}
                className="game-card"
                style={game.icon_url ? { backgroundImage: `url(${game.icon_url})` } : undefined}
                onClick={() => forum && navigate(`/forums/${forum.id}`)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && forum) {
                    navigate(`/forums/${forum.id}`);
                  }
                }}
              >
                <div className="game-card-title">{game.name}</div>
                {Array.isArray(game.tags) && game.tags.length > 0 ? (
                  <div className="tag-row">
                    {game.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="tag-pill">{tag}</span>
                    ))}
                  </div>
                ) : null}
                <p>{game.description || 'No description yet.'}</p>
                <div className="game-card-hint">Open forum →</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
