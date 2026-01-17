import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { threadsAPI, commentsAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import Comment from '../components/Comment';
import '../styles/thread.css';

export default function ThreadPage() {
  const { forumId, threadId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [thread, setThread] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchThread = async () => {
      try {
        const response = await threadsAPI.getThread(
          forumId,
          threadId,
          pagination.page,
          pagination.limit
        );
        setThread(response.data.data);
        setComments(response.data.data.comments);
        setPagination(response.data.pagination);
      } catch (err) {
        setError('Failed to load thread');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchThread();
  }, [forumId, threadId, pagination.page]);

  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await commentsAPI.createComment(forumId, threadId, newComment);
      setNewComment('');
      const response = await threadsAPI.getThread(
        forumId,
        threadId,
        pagination.page,
        pagination.limit
      );
      setThread(response.data.data);
      setComments(response.data.data.comments);
    } catch (err) {
      setError('Failed to create comment');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!window.confirm('Are you sure you want to delete this thread?')) return;

    try {
      await threadsAPI.deleteThread(forumId, threadId);
      navigate(`/forums/${forumId}`);
    } catch (err) {
      setError('Failed to delete thread');
    }
  };

  if (loading) return <div className="container"><p>Loading thread...</p></div>;
  if (error) return <div className="container"><p className="error-message">{error}</p></div>;
  if (!thread) return <div className="container"><p>Thread not found</p></div>;

  const isThreadOwner = user && user.id === thread.user_id;
  const isAdmin = user && user.role === 'admin';

  return (
    <div className="container">
      <button className="back-btn" onClick={() => navigate(`/forums/${forumId}`)}>
        Back to Forum
      </button>

      <div className="thread-detail">
        <div className="thread-header">
          <h2>{thread.title}</h2>
          {(isThreadOwner || isAdmin) && (
            <button className="delete-btn" onClick={handleDeleteThread}>
              Delete Thread
            </button>
          )}
        </div>

        <div className="thread-meta">
          <span className="thread-author-meta">
            {thread.author_avatar_url ? (
              <img className="avatar-thumb" src={thread.author_avatar_url} alt={thread.author_username} />
            ) : (
              <span className="avatar-fallback">
                {thread.author_username?.charAt(0)?.toUpperCase()}
              </span>
            )}
            <strong
              className="username-link"
              onClick={() => navigate(`/user/${thread.user_id}`)}
            >
              {thread.author_username}
            </strong>
            {thread.author_role === 'admin' && (
              <span className="role-badge admin">Admin</span>
            )}
          </span>
          <span>Posted {new Date(thread.created_at).toLocaleDateString()}</span>
          <span>{thread.view_count} views</span>
        </div>

        {thread.image_url && (
          <div className="thread-image">
            <img src={thread.image_url} alt="Thread attachment" />
          </div>
        )}

        <div className="thread-content">
          {thread.content}
        </div>
      </div>

      <div className="comments-section">
        <h3>Comments ({comments.length})</h3>

        {isAuthenticated ? (
          <form className="comment-form" onSubmit={handleCreateComment}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              rows={4}
              required
            />
            <button type="submit" disabled={submitting} className="submit-btn">
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        ) : (
          <p className="login-prompt">
            <a href="/login">Login</a> to comment on this thread
          </p>
        )}

        <div className="comments-list">
          {comments.length === 0 ? (
            <p className="no-content">No comments yet</p>
          ) : (
            comments.map((comment) => (
              <Comment
                key={comment.id}
                comment={comment}
                forumId={forumId}
                threadId={threadId}
                isOwner={user && user.id === comment.user_id}
                onUpdate={() => {
                  const response = threadsAPI.getThread(
                    forumId,
                    threadId,
                    pagination.page,
                    pagination.limit
                  );
                  response.then((res) => {
                    setComments(res.data.data.comments);
                  });
                }}
              />
            ))
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
    </div>
  );
}
