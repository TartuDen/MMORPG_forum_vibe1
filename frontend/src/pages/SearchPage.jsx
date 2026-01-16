import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/search.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  
  const [threads, setThreads] = useState([]);
  const [comments, setComments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('threads');

  useEffect(() => {
    if (!query.trim()) {
      setError('Enter a search query');
      return;
    }

    const performSearch = async () => {
      setLoading(true);
      setError('');

      try {
        const threadRes = await axios.get(`${API_BASE_URL}/search/threads?q=${encodeURIComponent(query)}&limit=20`);
        const commentRes = await axios.get(`${API_BASE_URL}/search/comments?q=${encodeURIComponent(query)}&limit=20`);
        const userRes = await axios.get(`${API_BASE_URL}/search/users?q=${encodeURIComponent(query)}&limit=20`);

        setThreads(threadRes.data.data);
        setComments(commentRes.data.data);
        setUsers(userRes.data.data);
      } catch (err) {
        setError('Search failed. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [query]);

  if (!query) {
    return (
      <div className="container">
        <div className="search-empty">
          <h2>Search Forums</h2>
          <p>Enter a query in the search box to find threads, comments, and users</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="search-header">
        <h2>Search Results for "{query}"</h2>
        {error && <div className="error-message">{error}</div>}
      </div>

      {loading ? (
        <p>Searching...</p>
      ) : (
        <div className="search-results">
          <div className="search-tabs">
            <button
              className={`tab ${activeTab === 'threads' ? 'active' : ''}`}
              onClick={() => setActiveTab('threads')}
            >
              Threads ({threads.length})
            </button>
            <button
              className={`tab ${activeTab === 'comments' ? 'active' : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              Comments ({comments.length})
            </button>
            <button
              className={`tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Users ({users.length})
            </button>
          </div>

          <div className="search-content">
            {activeTab === 'threads' && (
              <div className="results-list">
                {threads.length === 0 ? (
                  <p className="no-results">No threads found</p>
                ) : (
                  threads.map((thread) => (
                    <div
                      key={thread.id}
                      className="result-item"
                      onClick={() => navigate(`/forums/${thread.forum_id}/threads/${thread.id}`)}
                    >
                      <h4>{thread.title}</h4>
                      <p>{thread.content.substring(0, 150)}...</p>
                      <div className="result-meta">
                        <span>In {thread.forum_name}</span>
                        <span>By {thread.author_username}</span>
                        <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="results-list">
                {comments.length === 0 ? (
                  <p className="no-results">No comments found</p>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="result-item"
                      onClick={() => navigate(`/forums/*/threads/${comment.thread_id}`)}
                    >
                      <p>{comment.content.substring(0, 200)}...</p>
                      <div className="result-meta">
                        <span>In thread "{comment.thread_title}"</span>
                        <span>By {comment.author_username}</span>
                        <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="results-list">
                {users.length === 0 ? (
                  <p className="no-results">No users found</p>
                ) : (
                  users.map((user) => (
                    <div key={user.id} className="result-item user-result">
                      <div>
                        <h4>{user.username}</h4>
                        {user.bio && <p>{user.bio}</p>}
                        <div className="result-meta">
                          <span>{user.total_posts} posts</span>
                          <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className="user-badge">{user.role}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
