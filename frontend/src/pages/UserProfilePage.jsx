import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usersAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import '../styles/user-profile.css';

export default function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, uploadAvatar } = useAuth();
  const [user, setUser] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [avatarData, setAvatarData] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const maxAvatarBytes = 100 * 1024;

  useEffect(() => {
    return () => {
      if (avatarData && avatarData.startsWith('blob:')) {
        URL.revokeObjectURL(avatarData);
      }
    };
  }, [avatarData]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const response = await usersAPI.getUser(userId);
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

  const isOwnProfile = currentUser && parseInt(userId, 10) === currentUser.id;

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    setAvatarError('');
    if (!file) {
      setAvatarData('');
      setAvatarFile(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarError('Only image files are allowed');
      return;
    }

    if (file.size > maxAvatarBytes) {
      setAvatarError('Avatar must be 100KB or less');
      return;
    }

    setAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setAvatarData(previewUrl);
  };

  const handleAvatarSave = async () => {
    if (!avatarFile) return;
    setAvatarSaving(true);
    setAvatarError('');
    try {
      const updated = await uploadAvatar(avatarFile);
      setUser(updated);
      setAvatarData('');
      setAvatarFile(null);
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Failed to update avatar');
    } finally {
      setAvatarSaving(false);
    }
  };

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
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} />
          ) : (
            user.username.charAt(0).toUpperCase()
          )}
        </div>
        <div className="profile-info">
          <h1>{user.username}</h1>
          {user.bio && <p className="profile-bio">{user.bio}</p>}
          <p className="profile-meta">Member since {memberSince}</p>
          {!isOwnProfile && currentUser && (
            <button
              className="submit-btn"
              onClick={() => navigate(`/messages?userId=${user.id}`)}
            >
              Message
            </button>
          )}
        </div>
      </div>

      {isOwnProfile && (
        <div className="profile-section">
          <h2>Update Avatar</h2>
          <div className="avatar-uploader">
            <input type="file" accept="image/*" onChange={handleAvatarChange} />
            <small>Max size 100KB</small>
            {avatarError && <div className="error-message">{avatarError}</div>}
            {avatarData && (
              <div className="avatar-preview">
                <img src={avatarData} alt="Avatar preview" />
              </div>
            )}
            <button
              className="submit-btn"
              onClick={handleAvatarSave}
              disabled={!avatarData || avatarSaving}
            >
              {avatarSaving ? 'Saving...' : 'Save Avatar'}
            </button>
          </div>
        </div>
      )}

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
