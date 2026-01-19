import { useEffect, useState } from 'react';
import { usersAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import '../styles/admin-users.css';

const formatDate = (value) => {
  if (!value) return 'n/a';
  const date = new Date(value);
  return date.toLocaleString();
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [roleSelection, setRoleSelection] = useState({});

  const loadOverview = async (nextPage) => {
    try {
      setLoading(true);
      setError('');
      const response = await usersAPI.getAdminOverview(nextPage, 50);
      setUsers(response.data.data || []);
      setPagination(response.data.pagination);
      setPage(nextPage);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load admin overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview(1);
  }, []);

  useEffect(() => {
    const nextSelection = {};
    users.forEach((member) => {
      nextSelection[member.id] = member.role;
    });
    setRoleSelection(nextSelection);
  }, [users]);

  const handleRoleSelect = (userId, role) => {
    setRoleSelection((prev) => ({ ...prev, [userId]: role }));
  };

  const handleRoleChange = async (targetId, role) => {
    try {
      setUpdatingId(targetId);
      setError('');
      await usersAPI.updateUserRole(targetId, role);
      await loadOverview(page);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update role');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="container">
      <div className="admin-header">
        <div>
          <h2>Admin Control Room</h2>
          <p>Review user activity, roles, and recent engagement.</p>
        </div>
        <div className="admin-actions">
          <button
            type="button"
            className="users-nav-btn"
            disabled={!pagination || page <= 1}
            onClick={() => loadOverview(page - 1)}
          >
            Prev
          </button>
          <button
            type="button"
            className="users-nav-btn"
            disabled={!pagination || page >= pagination.pages}
            onClick={() => loadOverview(page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading admin overview...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : (
        <div className="admin-table">
          <div className="admin-row admin-row-header">
            <span>User</span>
            <span>Role</span>
            <span>Posts</span>
            <span>Threads</span>
            <span>Comments</span>
              <span>Last activity</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
          {users.map((member) => (
            <div key={member.id} className="admin-row">
              <div className="admin-user">
                <div className="admin-name">{member.username}</div>
                <div className="admin-email">{member.email}</div>
                <div className="admin-joined">Joined {formatDate(member.created_at)}</div>
              </div>
              <span className={`role-badge ${member.role}`}>{member.role}</span>
              <span>{member.total_posts || 0}</span>
              <span>{member.thread_count || 0}</span>
              <span>{member.comment_count || 0}</span>
              <span>{formatDate(member.last_activity_at)}</span>
              <span className="admin-status">
                {member.is_banned ? 'Banned' : member.is_email_verified ? 'Verified' : 'Unverified'}
              </span>
              <div className="admin-actions-cell">
                <select
                  className="admin-role-select"
                  value={roleSelection[member.id] || member.role}
                  onChange={(event) => handleRoleSelect(member.id, event.target.value)}
                  disabled={currentUser?.id === member.id}
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="button"
                  className="admin-action-btn"
                  disabled={updatingId === member.id || currentUser?.id === member.id}
                  onClick={() => handleRoleChange(member.id, roleSelection[member.id] || member.role)}
                >
                  Update role
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
