import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { threadsAPI } from '../services/api';
import '../styles/create-thread.css';

export default function CreateThreadPage() {
  const { forumId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      return;
    }

    if (title.length < 5) {
      setError('Title must be at least 5 characters');
      return;
    }

    if (content.length < 20) {
      setError('Content must be at least 20 characters');
      return;
    }

    setLoading(true);
    try {
      await threadsAPI.createThread(forumId, title, content);
      navigate(`/forums/${forumId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create thread');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <button className="back-btn" onClick={() => navigate(`/forums/${forumId}`)}>
        ← Back to Forum
      </button>

      <div className="create-thread-box">
        <h2>Create New Thread</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Thread Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter thread title (minimum 5 characters)"
              maxLength="500"
              required
            />
            <small>{title.length}/500</small>
          </div>

          <div className="form-group">
            <label htmlFor="content">Content</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your thread content (minimum 20 characters)"
              rows={10}
              maxLength="5000"
              required
            />
            <small>{content.length}/5000</small>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => navigate(`/forums/${forumId}`)}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Creating...' : 'Create Thread'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
