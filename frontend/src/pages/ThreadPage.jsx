import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { authAPI, threadsAPI, commentsAPI, reputationAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import Comment from '../components/Comment';
import '../styles/thread.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_IO_URL || 'http://localhost:5000';

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
  const [voteError, setVoteError] = useState('');
  const [voteLoading, setVoteLoading] = useState(false);

  const socket = useMemo(() => {
    return io(SOCKET_URL, { withCredentials: true, autoConnect: false });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;

    const connectSocket = async () => {
      try {
        const tokenResponse = await authAPI.getSocketToken();
        const token = tokenResponse.data?.data?.token;
        if (!mounted) return;
        if (token) {
          socket.auth = { token };
          socket.connect();
        }
      } catch (err) {
        // Ignore socket auth errors; fallback to non-realtime updates.
      }
    };

    connectSocket();

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [socket, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleThreadVote = (payload) => {
      const threadIdValue = Number.parseInt(threadId, 10);
      if (!payload || payload.thread_id !== threadIdValue) return;
      setThread((prev) => (prev ? { ...prev, vote_score: payload.score } : prev));
    };

    const handleCommentVote = (payload) => {
      const threadIdValue = Number.parseInt(threadId, 10);
      if (!payload || payload.thread_id !== threadIdValue) return;
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === payload.comment_id
            ? { ...comment, vote_score: payload.score }
            : comment
        )
      );
    };

    const handleConnect = () => {
      socket.emit('thread:join', threadId);
    };

    socket.on('connect', handleConnect);
    socket.on('reputation:thread_vote', handleThreadVote);
    socket.on('reputation:comment_vote', handleCommentVote);

    return () => {
      socket.emit('thread:leave', threadId);
      socket.off('connect', handleConnect);
      socket.off('reputation:thread_vote', handleThreadVote);
      socket.off('reputation:comment_vote', handleCommentVote);
    };
  }, [socket, threadId, isAuthenticated]);

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
  const viewerVote = thread.viewer_vote === null || thread.viewer_vote === undefined
    ? null
    : Number(thread.viewer_vote);

  const handleThreadVote = async (value) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (isThreadOwner) {
      setVoteError('You cannot vote on your own thread.');
      return;
    }

    setVoteError('');
    setVoteLoading(true);
    try {
      const nextValue = viewerVote === value
        ? 0
        : (viewerVote === null ? value : 0);
      const response = await reputationAPI.voteThread(thread.id, nextValue);
      setThread(prev => ({
        ...prev,
        vote_score: response.data.data.score,
        viewer_vote: response.data.data.user_vote
      }));
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to record vote');
    } finally {
      setVoteLoading(false);
    }
  };

  return (
    <div className="container">
      <button className="back-btn" onClick={() => navigate(`/forums/${forumId}`)}>
        Back to Forum
      </button>

      <div className="thread-detail">
        <div className="thread-header">
          <div className="thread-vote">
            <button
              type="button"
              className={`vote-btn up ${viewerVote === 1 ? 'active' : ''}`}
              onClick={() => handleThreadVote(1)}
              disabled={voteLoading}
              title="Upvote thread"
            >
              ▲
            </button>
            <span className="vote-score">{thread.vote_score ?? 0}</span>
            <button
              type="button"
              className={`vote-btn down ${viewerVote === -1 ? 'active' : ''}`}
              onClick={() => handleThreadVote(-1)}
              disabled={voteLoading}
              title="Downvote thread"
            >
              ▼
            </button>
          </div>
          <h2>{thread.title}</h2>
          {(isThreadOwner || isAdmin) && (
            <button className="delete-btn" onClick={handleDeleteThread}>
              Delete Thread
            </button>
          )}
        </div>

        {voteError && <div className="error-message">{voteError}</div>}

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
