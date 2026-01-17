import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { commentsAPI, reputationAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import '../styles/comment.css';

export default function Comment({ comment, forumId, threadId, isOwner, onUpdate }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voteScore, setVoteScore] = useState(comment.vote_score ?? 0);
  const [viewerVote, setViewerVote] = useState(comment.viewer_vote ?? null);
  const [voteError, setVoteError] = useState('');
  const [voteLoading, setVoteLoading] = useState(false);

  useEffect(() => {
    setVoteScore(comment.vote_score ?? 0);
    setViewerVote(
      comment.viewer_vote === null || comment.viewer_vote === undefined
        ? null
        : Number(comment.viewer_vote)
    );
  }, [comment.vote_score, comment.viewer_vote, comment.id]);

  const handleUpdate = async () => {
    if (!editContent.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    setSubmitting(true);
    try {
      await commentsAPI.updateComment(forumId, threadId, comment.id, editContent);
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      setError('Failed to update comment');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    setSubmitting(true);
    try {
      await commentsAPI.deleteComment(forumId, threadId, comment.id);
      onUpdate();
    } catch (err) {
      setError('Failed to delete comment');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (comment.is_deleted) {
    return <div className="comment deleted-comment">Comment deleted</div>;
  }

  const handleVote = async (value) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (isOwner) {
      setVoteError('You cannot vote on your own comment.');
      return;
    }

    setVoteError('');
    setVoteLoading(true);
    try {
      const nextValue = viewerVote === value
        ? 0
        : (viewerVote === null ? value : 0);
      const response = await reputationAPI.voteComment(comment.id, nextValue);
      setVoteScore(response.data.data.score);
      setViewerVote(response.data.data.user_vote);
    } catch (err) {
      setVoteError(err.response?.data?.error || 'Failed to record vote');
    } finally {
      setVoteLoading(false);
    }
  };

  return (
    <div className="comment">
      <div className="comment-header">
        <div className="comment-author">
          {comment.author_avatar_url ? (
            <img className="avatar-thumb" src={comment.author_avatar_url} alt={comment.author_username} />
          ) : (
            <span className="avatar-fallback">
              {comment.author_username?.charAt(0)?.toUpperCase()}
            </span>
          )}
          <strong 
            className="username-link"
            onClick={() => navigate(`/user/${comment.user_id}`)}
          >{comment.author_username}</strong>
          {comment.author_role === 'admin' && (
            <span className="role-badge admin">Admin</span>
          )}
          <span className="comment-date">
            {new Date(comment.created_at).toLocaleString()}
          </span>
          {comment.is_edited && <span className="edited-badge">edited</span>}
        </div>
        <div className="comment-controls">
          <div className="comment-vote">
            <button
              type="button"
              className={`vote-btn up ${viewerVote === 1 ? 'active' : ''}`}
              onClick={() => handleVote(1)}
              disabled={voteLoading}
              title="Upvote comment"
            >
              ▲
            </button>
            <span className="vote-score">{voteScore}</span>
            <button
              type="button"
              className={`vote-btn down ${viewerVote === -1 ? 'active' : ''}`}
              onClick={() => handleVote(-1)}
              disabled={voteLoading}
              title="Downvote comment"
            >
              ▼
            </button>
          </div>
          {isOwner && !isEditing && (
            <div className="comment-actions">
              <button
                className="edit-btn"
                onClick={() => setIsEditing(true)}
                title="Edit comment"
              >
                Edit
              </button>
              <button
                className="delete-btn"
                onClick={handleDelete}
                disabled={submitting}
                title="Delete comment"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {voteError && <div className="vote-error">{voteError}</div>}

      {isEditing ? (
        <div className="comment-edit">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
          />
          <div className="edit-actions">
            <button
              className="cancel-btn"
              onClick={() => setIsEditing(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="submit-btn"
              onClick={handleUpdate}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="comment-content">
          {comment.content}
        </div>
      )}
    </div>
  );
}
