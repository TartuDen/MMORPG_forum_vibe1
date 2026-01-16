import { useState } from 'react';
import { commentsAPI } from '../services/api';
import '../styles/comment.css';

export default function Comment({ comment, forumId, threadId, isOwner, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="comment">
      <div className="comment-header">
        <div className="comment-author">
          <strong>{comment.author_username}</strong>
          <span className="comment-date">
            {new Date(comment.created_at).toLocaleString()}
          </span>
          {comment.is_edited && <span className="edited-badge">edited</span>}
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

      {error && <div className="error-message">{error}</div>}

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
