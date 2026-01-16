import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { forumsAPI } from '../services/api';
import '../styles/create-forum.css';

export default function CreateForumPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    gameId: '',
    name: '',
    description: ''
  });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [charCounts, setCharCounts] = useState({
    name: 0,
    description: 0
  });

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await forumsAPI.getGames();
        setGames(response.data.data);
      } catch (err) {
        setError('Failed to load games');
        console.error(err);
      }
    };
    fetchGames();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (name === 'name' || name === 'description') {
      setCharCounts(prev => ({
        ...prev,
        [name]: value.length
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.gameId) {
      setError('Please select a game');
      return;
    }

    if (formData.name.length < 3 || formData.name.length > 100) {
      setError('Forum name must be between 3 and 100 characters');
      return;
    }

    if (formData.description.length < 10 || formData.description.length > 500) {
      setError('Description must be between 10 and 500 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await forumsAPI.createForum(
        parseInt(formData.gameId),
        formData.name,
        formData.description
      );
      navigate('/');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 
                       err.response?.data?.message || 
                       'Failed to create forum';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="create-forum-wrapper">
        <button className="btn-back" onClick={() => navigate('/')}>← Back to Forums</button>
        
        <div className="create-forum-box">
          <h2>Create New Forum</h2>
          
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="gameId">Select Game *</label>
              <select
                id="gameId"
                name="gameId"
                value={formData.gameId}
                onChange={handleInputChange}
                required
              >
                <option value="">-- Choose a game --</option>
                {games.map(game => (
                  <option key={game.id} value={game.id}>
                    {game.icon_url} {game.name}
                  </option>
                ))}
              </select>
              <small className="form-hint">The game category for this forum</small>
            </div>

            <div className="form-group">
              <label htmlFor="name">Forum Name *</label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Raid Strategies, General Discussion"
                maxLength="100"
                required
              />
              <div className="char-counter">
                {charCounts.name}/100 characters
              </div>
              <small className="form-hint">3-100 characters, must be descriptive</small>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe what topics belong in this forum. Be specific so members know when to post here."
                rows="5"
                maxLength="500"
                required
              />
              <div className="char-counter">
                {charCounts.description}/500 characters
              </div>
              <small className="form-hint">10-500 characters</small>
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={loading}
            >
              {loading ? 'Creating Forum...' : 'Create Forum'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
