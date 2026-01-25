import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usersAPI } from '../services/api';
import '../styles/admin-user-activity.css';

const THREAD_PAGE_SIZE = 10;

const formatDate = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return date.toLocaleString();
};

const getSnippet = (value, length = 160) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= length) return trimmed;
  return `${trimmed.slice(0, length)}...`;
};

const getSafePage = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return parsed;
};

export default function AdminUserActivityPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'threads' ? 'threads' : 'posts';
  const page = getSafePage(searchParams.get('page'));

  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const response = await usersAPI.getUser(userId);
        if (!mounted) return;
        setUser(response.data.data);
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.error || 'Failed to load user');
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    let mounted = true;

    const loadActivity = async () => {
      try {
        setLoading(true);
        setError('');
        const response = view === 'threads'
          ? await usersAPI.getAdminUserThreads(userId, page, 20)
          : await usersAPI.getAdminUserPosts(userId, page, 20, THREAD_PAGE_SIZE);
        if (!mounted) return;
        setItems(response.data.data || []);
        setPagination(response.data.pagination);
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.error || 'Failed to load activity');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadActivity();

    return () => {
      mounted = false;
    };
  }, [userId, view, page]);

  const handleViewChange = (nextView) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', nextView);
      next.set('page', '1');
      return next;
    });
  };

  const handlePageChange = (nextPage) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', view);
      next.set('page', String(nextPage));
      return next;
    });
  };

  const title = view === 'threads' ? 'Threads Created' : 'Total Posts';

  return (
    <div className="container">
      <div className="activity-header">
        <div>
          <button type="button" className="btn-back" onClick={() => navigate('/admin/users')}>
            Back to Users
          </button>
          <h2>{title}</h2>
          <p>
            {user ? user.username : 'User'} activity overview.
          </p>
        </div>
        <div className="activity-tabs">
          <button
            type="button"
            className={`activity-tab ${view === 'posts' ? 'active' : ''}`}
            onClick={() => handleViewChange('posts')}
          >
            Posts
          </button>
          <button
            type="button"
            className={`activity-tab ${view === 'threads' ? 'active' : ''}`}
            onClick={() => handleViewChange('threads')}
          >
            Threads
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading activity...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : items.length === 0 ? (
        <p className="no-content">No activity yet.</p>
      ) : (
        <div className="activity-list">
          {items.map((item) => {
            if (view === 'threads') {
              const threadLink = `/forums/${item.forum_id}/threads/${item.id}`;
              return (
                <div key={item.id} className="activity-card">
                  <div className="activity-label">Thread</div>
                  <div className="activity-title">
                    <Link to={threadLink}>{item.title}</Link>
                  </div>
                  <div className="activity-meta">
                    {item.game_name} - {item.forum_name}
                  </div>
                  <div className="activity-submeta">
                    Created {formatDate(item.created_at)} - Answers {item.comment_count || 0} - Views {item.view_count || 0}
                  </div>
                  {item.content && (
                    <div className="activity-snippet">{getSnippet(item.content)}</div>
                  )}
                </div>
              );
            }

            const isThread = item.post_type === 'thread';
            const threadLink = isThread
              ? `/forums/${item.forum_id}/threads/${item.thread_id}`
              : `/forums/${item.forum_id}/threads/${item.thread_id}?page=${item.thread_page}#comment-${item.comment_id}`;
            const label = isThread ? 'Thread' : 'Comment';
            const answers = item.comment_count || 0;
            const replies = item.reply_count || 0;

            return (
              <div
                key={isThread ? `thread-${item.thread_id}` : `comment-${item.comment_id}`}
                className="activity-card"
              >
                <div className={`activity-label ${isThread ? 'thread' : 'comment'}`}>{label}</div>
                <div className="activity-title">
                  <Link to={threadLink}>{item.thread_title}</Link>
                </div>
                <div className="activity-meta">
                  {item.game_name} - {item.forum_name}
                </div>
                <div className="activity-submeta">
                  {isThread
                    ? `Created ${formatDate(item.created_at)} - Answers ${answers} - Views ${item.view_count || 0}`
                    : `Posted ${formatDate(item.created_at)} - Answers ${answers} - Replies ${replies}`}
                </div>
                {item.content && (
                  <div className="activity-snippet">{getSnippet(item.content)}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="activity-pagination">
          <button
            type="button"
            className="users-nav-btn"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            Prev
          </button>
          <span className="activity-page">Page {page} of {pagination.pages}</span>
          <button
            type="button"
            className="users-nav-btn"
            disabled={page >= pagination.pages}
            onClick={() => handlePageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

