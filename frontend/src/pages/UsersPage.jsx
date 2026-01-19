import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../services/api';
import { usePresence } from '../services/presenceContext';
import '../styles/users.css';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { onlineUserIds } = usePresence();

  const loadUsers = async (nextPage) => {
    try {
      setLoading(true);
      setError('');
      const response = await usersAPI.getUsers(nextPage, 50);
      setUsers(response.data.data || []);
      setPagination(response.data.pagination);
      setPage(nextPage);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(1);
  }, []);

  const totalUsers = pagination?.total || users.length;

  return (
    <div className="container">
      <div className="users-header">
        <div>
          <h2>All Users</h2>
          <p>{totalUsers} registered members</p>
        </div>
        <div className="users-actions">
          <button
            type="button"
            className="users-nav-btn"
            disabled={!pagination || page <= 1}
            onClick={() => loadUsers(page - 1)}
          >
            Prev
          </button>
          <button
            type="button"
            className="users-nav-btn"
            disabled={!pagination || page >= pagination.pages}
            onClick={() => loadUsers(page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading users...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : users.length === 0 ? (
        <p className="empty-state">No users found.</p>
      ) : (
        <div className="users-grid">
          {users.map((member) => (
            <button
              key={member.id}
              type="button"
              className="user-card"
              onClick={() => navigate(`/user/${member.id}`)}
            >
              <div className="user-card-header">
                {member.avatar_url ? (
                  <img className="avatar-thumb" src={member.avatar_url} alt={member.username} />
                ) : (
                  <span className="avatar-fallback">{member.username?.charAt(0)?.toUpperCase()}</span>
                )}
                <div>
                  <div className="user-name-row">
                    <span className={`presence-dot ${onlineUserIds.has(member.id) ? '' : 'offline'}`} />
                    <span className="user-name">{member.username}</span>
                  </div>
                  <span className={`role-badge ${member.role}`}>{member.role}</span>
                </div>
              </div>
              <div className="user-card-body">
                <span>Posts: {member.total_posts || 0}</span>
                <span>Joined: {new Date(member.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
