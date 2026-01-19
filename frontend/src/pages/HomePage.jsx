import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forumsAPI, usersAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import { usePresence } from '../services/presenceContext';
import '../styles/home.css';

export default function HomePage() {
  const [forums, setForums] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generalThreads, setGeneralThreads] = useState([]);
  const [generalThreadsLoading, setGeneralThreadsLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [usersTotal, setUsersTotal] = useState(0);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { onlineUserIds } = usePresence();
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
  const sortedGamesWithForums = [...gamesWithForums].sort((a, b) => a.name.localeCompare(b.name));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const letterIndex = {};
  const indexToLetter = {};
  sortedGamesWithForums.forEach((game, index) => {
    const letter = game.name?.charAt(0)?.toUpperCase() || '';
    if (!alphabet.includes(letter)) {
      return;
    }
    if (letterIndex[letter] === undefined) {
      letterIndex[letter] = index;
      indexToLetter[index] = letter;
    }
  });
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

  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      setUsersTotal(0);
      setUsersError('');
      return;
    }
    let active = true;
    setUsersLoading(true);
    setUsersError('');
    usersAPI.getUsers(1, 50)
      .then((response) => {
        if (!active) return;
        const payload = response.data?.data || [];
        setUsers(payload);
        setUsersTotal(response.data?.pagination?.total || payload.length);
      })
      .catch(() => {
        if (active) {
          setUsersError('Failed to load users');
        }
      })
      .finally(() => {
        if (active) {
          setUsersLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const sortedUsers = [...users].sort((a, b) => {
    const aOnline = onlineUserIds.has(a.id) ? 1 : 0;
    const bOnline = onlineUserIds.has(b.id) ? 1 : 0;
    if (aOnline !== bOnline) {
      return bOnline - aOnline;
    }
    return a.username.localeCompare(b.username);
  });
  const onlineCount = onlineUserIds.size;
  const layoutClass = isAuthenticated ? 'home-layout' : 'home-layout full';
  const handleAlphabetClick = (letter) => {
    const anchor = document.getElementById(`letter-${letter}`);
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) return <div className="container"><p>Loading forums...</p></div>;
  if (error) return <div className="container"><p className="error-message">{error}</p></div>;

  return (
    <div className="container">
      <div className="home-header">
        <div className="header-content">
          <h2>Not-A-Forum</h2>
          <p>Notes for gamers, not another game forum.</p>
        </div>
        {isAdmin && (
          <button className="create-forum-btn" onClick={() => navigate('/create-forum?mode=manage')}>
            Manage Games
          </button>
        )}
      </div>

      <div className={layoutClass}>
        <div className="home-main">
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
                        by {thread.author_username} | {thread.comment_count || 0} replies
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
            <div className="alphabet-bar">
              {alphabet.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  className={`alphabet-btn ${letterIndex[letter] === undefined ? 'disabled' : ''}`}
                  onClick={() => handleAlphabetClick(letter)}
                  disabled={letterIndex[letter] === undefined}
                >
                  {letter}
                </button>
              ))}
            </div>
            <div className="games-grid">
              {sortedGamesWithForums.map((game, index) => {
                const forum = forumByGame[game.id];
                return (
                  <div
                    key={game.id}
                    id={indexToLetter[index] ? `letter-${indexToLetter[index]}` : undefined}
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
                    <div className="game-card-hint">Open forum</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="home-sidebar">
          {isAuthenticated && (
            <div className="online-users-card">
              <div className="online-users-header">
                <h3>Community Pulse</h3>
                <span className="online-count">{onlineCount} online</span>
              </div>
              {usersLoading ? (
                <p className="muted">Loading users...</p>
              ) : usersError ? (
                <p className="muted">{usersError}</p>
              ) : (
                <div className="online-users-list">
                  {sortedUsers.length === 0 ? (
                    <p className="muted">No users yet.</p>
                  ) : (
                    sortedUsers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className="online-user"
                        onClick={() => navigate(`/user/${member.id}`)}
                      >
                        <span className={`presence-dot ${onlineUserIds.has(member.id) ? '' : 'offline'}`} />
                        <span className="online-user-name">{member.username}</span>
                        <span className="online-user-role">{member.role}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              <div className="online-users-footer">
                <span className="muted">{usersTotal} registered</span>
                <button type="button" className="link-btn" onClick={() => navigate('/users')}>
                  View all users
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
