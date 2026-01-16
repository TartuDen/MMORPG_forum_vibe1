import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { forumsAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import '../styles/forum.css';

export default function ForumPage() {
  const { forumId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [forum, setForum] = useState(null);
  const [threads, setThreads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchForum = async () => {
      try {
        const response = await forumsAPI.getForum(
          forumId,
          pagination.page,
          pagination.limit
        );
        setForum(response.data.data);
        setThreads(response.data.data.threads);
        setPagination(response.data.pagination);
      } catch (err) {
        setError('Failed to load forum');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchForum();
  }, [forumId, pagination.page]);

  if (loading) return <div className="container"><p>Loading forum...</p></div>;
  if (error) return <div className="container"><p className="error-message">{error}</p></div>;
  if (!forum) return <div className="container"><p>Forum not found</p></div>;

  return (
    <div className="container">
      <div className="forum-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back to Forums</button>
        <h2>{forum.name}</h2>
        <p>{forum.description}</p>
      </div>

      {isAuthenticated && (
        <div className="forum-actions">
          <button
            className="create-btn"
            onClick={() => navigate(`/forums/${forumId}/create-thread`)}
          >
            + Create Thread
          </button>
        </div>
      )}

      <div className="threads-section">
        {threads.length === 0 ? (
          <p className="no-content">No threads yet. Be the first to create one!</p>
        ) : (
          <table className="threads-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Replies</th>
                <th>Views</th>
                <th>Last Post</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((thread) => (
                <tr
                  key={thread.id}
                  className="thread-row"
                  onClick={() => navigate(`/forums/${forumId}/threads/${thread.id}`)}
                >
                  <td className="thread-title">
                    {thread.is_pinned && <span className="pinned-badge">📌</span>}
                    {thread.title}
                  </td>
                  <td className="thread-author">
                    <span 
                      className="username-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/user/${thread.author_id}`);
                      }}
                    >
                      {thread.author_username}
                    </span>
                  </td>
                  <td className="thread-replies">{thread.comment_count}</td>
                  <td className="thread-views">{thread.view_count}</td>
                  <td className="thread-date">
                    {new Date(thread.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="pagination">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={`page-btn ${page === pagination.page ? 'active' : ''}`}
              onClick={() => setPagination({ ...pagination, page })}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
