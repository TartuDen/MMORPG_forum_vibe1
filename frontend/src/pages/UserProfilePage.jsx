import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import '../styles/user-profile.css';

export default function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/users/${userId}`);
        setUser(response.data.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  if (loading) {
    return <div className="container"><p className="loading">Loading profile...</p></div>;
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-message">{error}</div>
        <button className="btn-back" onClick={() => navigate(-1)}>← Back</button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container">
        <div className="error-message">User not found</div>
        <button className="btn-back" onClick={() => navigate(-1)}>← Back</button>
      </div>
    );
  }

  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="container">
      <button className="btn-back" onClick={() => navigate(-1)}>← Back</button>
      
      <div className="profile-header">
        <div className="profile-avatar">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div className="profile-info">
          <h1>{user.username}</h1>
          <p className="profile-email">{user.email}</p>
          {user.bio && <p className="profile-bio">{user.bio}</p>}
          <p className="profile-meta">Member since {memberSince}</p>
        </div>
      </div>

      <div className="profile-stats">
        <div className="stat-card">
          <div className="stat-value">{user.total_posts || 0}</div>
          <div className="stat-label">Total Posts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{user.total_threads || 0}</div>
          <div className="stat-label">Threads Created</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{user.reputation || 0}</div>
          <div className="stat-label">Reputation</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{user.role || 'Member'}</div>
          <div className="stat-label">Role</div>
        </div>
      </div>

      {user.bio && (
        <div className="profile-section">
          <h2>About</h2>
          <p>{user.bio}</p>
        </div>
      )}

      <div className="profile-section">
        <h2>Account Information</h2>
        <div className="profile-detail">
          <span className="detail-label">Member Since:</span>
          <span className="detail-value">{memberSince}</span>
        </div>
        <div className="profile-detail">
          <span className="detail-label">Role:</span>
          <span className="detail-value">{user.role || 'Member'}</span>
        </div>
        <div className="profile-detail">
          <span className="detail-label">Total Posts:</span>
          <span className="detail-value">{user.total_posts || 0}</span>
        </div>
        <div className="profile-detail">
          <span className="detail-label">Threads Created:</span>
          <span className="detail-value">{user.total_threads || 0}</span>
        </div>
      </div>
    </div>
  );
}
