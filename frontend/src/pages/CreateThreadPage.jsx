import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { threadsAPI } from '../services/api';
import '../styles/create-thread.css';

export default function CreateThreadPage() {
  const { forumId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageData, setImageData] = useState('');
  const [imageError, setImageError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const maxImageBytes = 300 * 1024;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    setImageError('');
    if (!file) {
      setImageData('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setImageError('Only image files are allowed');
      return;
    }

    if (file.size > maxImageBytes) {
      setImageError('Image must be 300KB or less');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result);
    };
    reader.onerror = () => {
      setImageError('Failed to read image');
    };
    reader.readAsDataURL(file);
  };

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
      const response = await threadsAPI.createThread(forumId, title, content, imageData || null);
      const threadId = response.data?.data?.id;
      if (threadId) {
        navigate(`/forums/${forumId}/threads/${threadId}`);
      } else {
        navigate(`/forums/${forumId}`);
      }
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || 'Failed to create thread';
      setError(message);
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

          <div className="form-group">
            <label htmlFor="threadImage">Image (optional)</label>
            <input
              id="threadImage"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
            <small>Max size 300KB</small>
            {imageError && <div className="error-message">{imageError}</div>}
            {imageData && (
              <div className="image-preview">
                <img src={imageData} alt="Thread preview" />
              </div>
            )}
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
