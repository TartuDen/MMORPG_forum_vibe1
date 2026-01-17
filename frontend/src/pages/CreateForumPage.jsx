import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { forumsAPI, reputationAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import '../styles/create-forum.css';

const AVAILABLE_TAGS = [
  'mmorpg',
  'mmo',
  'pve',
  'pvp',
  'raid',
  'sandbox',
  'story',
  'crafting',
  'hardcore',
  'casual',
  'open-world',
  'dungeon',
  'online',
  'single',
  'solo',
  'party',
  'full-loot'
];

export default function CreateForumPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [repSettings, setRepSettings] = useState({
    min_account_age_days: 0
  });
  const [gameForm, setGameForm] = useState({
    name: '',
    description: '',
    tags: [],
    icon_url: '',
    website_url: ''
  });
  const [gameEdit, setGameEdit] = useState({
    id: '',
    name: '',
    description: '',
    tags: [],
    icon_url: '',
    website_url: ''
  });

  const fetchGames = async () => {
    try {
      const response = await forumsAPI.getGames();
      setGames(response.data.data);
    } catch (err) {
      setError('Failed to load games');
      console.error(err);
    }
  };

  const fetchReputationSettings = async () => {
    try {
      const response = await reputationAPI.getSettings();
      setRepSettings({
        min_account_age_days: response.data.data.min_account_age_days ?? 0
      });
    } catch (err) {
      setSettingsError('Failed to load reputation settings');
    }
  };

  useEffect(() => {
    fetchGames();
    fetchReputationSettings();
  }, []);

  useEffect(() => {
    const gameIdParam = searchParams.get('gameId');
    if (!gameIdParam) return;
    const gameIdValue = parseInt(gameIdParam, 10);
    if (Number.isNaN(gameIdValue)) return;
    const game = games.find((item) => item.id === gameIdValue);
    if (!game) return;

    setGameEdit({
      id: game.id,
      name: game.name || '',
      description: game.description || '',
      tags: Array.isArray(game.tags) ? game.tags : [],
      icon_url: game.icon_url || '',
      website_url: game.website_url || ''
    });
  }, [games, searchParams]);

  const mode = searchParams.get('mode') || 'manage';
  const showCreateGame = mode !== 'update';

  const handleGameInputChange = (e, type) => {
    const { name, value } = e.target;
    const setter = type === 'edit' ? setGameEdit : setGameForm;
    setter(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleTag = (tag, type) => {
    const setter = type === 'edit' ? setGameEdit : setGameForm;
    setter(prev => {
      const exists = prev.tags.includes(tag);
      return {
        ...prev,
        tags: exists ? prev.tags.filter(item => item !== tag) : [...prev.tags, tag]
      };
    });
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!gameForm.name.trim()) {
      setError('Game name is required');
      return;
    }

    if (gameForm.tags.length === 0) {
      setError('At least one tag is required');
      return;
    }

    setLoading(true);
    try {
      await forumsAPI.createGame({
        name: gameForm.name.trim(),
        description: gameForm.description.trim(),
        tags: gameForm.tags,
        icon_url: gameForm.icon_url.trim() || null,
        website_url: gameForm.website_url.trim() || null
      });
      setGameForm({ name: '', description: '', tags: [], icon_url: '', website_url: '' });
      await fetchGames();
      setSuccess('Game created successfully.');
    } catch (err) {
      const errorMsg = err.response?.data?.error ||
                       err.response?.data?.message ||
                       'Failed to create game';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGame = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!gameEdit.id) {
      setError('Select a game to update');
      return;
    }

    if (gameEdit.tags.length === 0) {
      setError('At least one tag is required');
      return;
    }

    setLoading(true);
    try {
      const response = await forumsAPI.updateGame(gameEdit.id, {
        name: gameEdit.name.trim(),
        description: gameEdit.description.trim(),
        tags: gameEdit.tags,
        icon_url: gameEdit.icon_url.trim() || null,
        website_url: gameEdit.website_url.trim() || null
      });
      if (response?.data?.data) {
        const updated = response.data.data;
        setGameEdit({
          id: updated.id,
          name: updated.name || '',
          description: updated.description || '',
          tags: Array.isArray(updated.tags) ? updated.tags : [],
          icon_url: updated.icon_url || '',
          website_url: updated.website_url || ''
        });
      }
      await fetchGames();
      setSuccess('Game updated successfully.');
    } catch (err) {
      const errorMsg = err.response?.data?.error ||
                       err.response?.data?.message ||
                       'Failed to update game';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsChange = (e) => {
    const { value } = e.target;
    setRepSettings(prev => ({
      ...prev,
      min_account_age_days: value
    }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsSuccess('');
    setSettingsLoading(true);

    const minDays = Number.parseInt(repSettings.min_account_age_days, 10);
    if (Number.isNaN(minDays) || minDays < 0 || minDays > 3650) {
      setSettingsError('Minimum account age must be between 0 and 3650 days');
      setSettingsLoading(false);
      return;
    }

    try {
      const response = await reputationAPI.updateSettings({ min_account_age_days: minDays });
      setRepSettings({
        min_account_age_days: response.data.data.min_account_age_days ?? minDays
      });
      setSettingsSuccess('Reputation settings updated.');
    } catch (err) {
      const errorMsg = err.response?.data?.error ||
                       err.response?.data?.message ||
                       'Failed to update reputation settings';
      setSettingsError(errorMsg);
    } finally {
      setSettingsLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="container">
        <div className="create-forum-wrapper">
          <button className="btn-back" onClick={() => navigate('/')}>Back to Forums</button>
          <div className="create-forum-box">
            <h2>Admin Access Required</h2>
            <p className="error-message">Only admins can manage games.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="create-forum-wrapper">
        <button className="btn-back" onClick={() => navigate('/')}>Back to Forums</button>

        {showCreateGame && (
          <div className="create-forum-box">
            <h2>Create New Game</h2>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <form onSubmit={handleCreateGame}>
              <div className="form-group">
                <label htmlFor="gameName">Game Name *</label>
                <input
                  id="gameName"
                  name="name"
                  type="text"
                  value={gameForm.name}
                  onChange={(e) => handleGameInputChange(e, 'create')}
                  placeholder="e.g., World of Warcraft"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="gameDescription">Description</label>
                <textarea
                  id="gameDescription"
                  name="description"
                  value={gameForm.description}
                  onChange={(e) => handleGameInputChange(e, 'create')}
                  placeholder="Short description"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Tags *</label>
                <div className="tag-grid">
                  {AVAILABLE_TAGS.map((tag) => (
                    <label key={tag} className="tag-option">
                      <input
                        type="checkbox"
                        checked={gameForm.tags.includes(tag)}
                        onChange={() => toggleTag(tag, 'create')}
                      />
                      <span>{tag}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="gameIcon">Icon URL</label>
                <input
                  id="gameIcon"
                  name="icon_url"
                  type="text"
                  value={gameForm.icon_url}
                  onChange={(e) => handleGameInputChange(e, 'create')}
                  placeholder="https://..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="gameWebsite">Website URL</label>
                <input
                  id="gameWebsite"
                  name="website_url"
                  type="text"
                  value={gameForm.website_url}
                  onChange={(e) => handleGameInputChange(e, 'create')}
                  placeholder="https://..."
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Creating Game...' : 'Create Game'}
              </button>
            </form>
          </div>
        )}

        <div className="create-forum-box">
          <h2>Update Game</h2>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form onSubmit={handleUpdateGame}>
            <div className="form-group">
              <label htmlFor="gameEditSelect">Select Game *</label>
              <select
                id="gameEditSelect"
                onChange={(e) => {
                  const gameId = parseInt(e.target.value, 10);
                  const game = games.find(item => item.id === gameId);
                  if (!game) {
                    setGameEdit({ id: '', name: '', description: '', tags: [], icon_url: '', website_url: '' });
                    return;
                  }
                  setGameEdit({
                    id: game.id,
                    name: game.name || '',
                    description: game.description || '',
                    tags: Array.isArray(game.tags) ? game.tags : [],
                    icon_url: game.icon_url || '',
                    website_url: game.website_url || ''
                  });
                }}
                value={gameEdit.id}
              >
                <option value="">-- Choose a game --</option>
                {games.map(game => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="gameEditName">Game Name</label>
              <input
                id="gameEditName"
                name="name"
                type="text"
                value={gameEdit.name}
                onChange={(e) => handleGameInputChange(e, 'edit')}
                placeholder="Game name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="gameEditDescription">Description</label>
              <textarea
                id="gameEditDescription"
                name="description"
                value={gameEdit.description}
                onChange={(e) => handleGameInputChange(e, 'edit')}
                placeholder="Description"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Tags *</label>
              <div className="tag-grid">
                {AVAILABLE_TAGS.map((tag) => (
                  <label key={tag} className="tag-option">
                    <input
                      type="checkbox"
                      checked={gameEdit.tags.includes(tag)}
                      onChange={() => toggleTag(tag, 'edit')}
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="gameEditIcon">Icon URL</label>
              <input
                id="gameEditIcon"
                name="icon_url"
                type="text"
                value={gameEdit.icon_url}
                onChange={(e) => handleGameInputChange(e, 'edit')}
                placeholder="https://..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="gameEditWebsite">Website URL</label>
              <input
                id="gameEditWebsite"
                name="website_url"
                type="text"
                value={gameEdit.website_url}
                onChange={(e) => handleGameInputChange(e, 'edit')}
                placeholder="https://..."
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Updating Game...' : 'Update Game'}
            </button>
          </form>
        </div>

        <div className="create-forum-box">
          <h2>Reputation Settings</h2>

          {settingsError && <div className="error-message">{settingsError}</div>}
          {settingsSuccess && <div className="success-message">{settingsSuccess}</div>}

          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label htmlFor="minAccountAge">Minimum account age to vote (days)</label>
              <input
                id="minAccountAge"
                name="min_account_age_days"
                type="number"
                min="0"
                max="3650"
                value={repSettings.min_account_age_days}
                onChange={handleSettingsChange}
              />
              <span className="form-hint">Set to 0 to allow voting immediately.</span>
            </div>

            <button type="submit" className="submit-btn" disabled={settingsLoading}>
              {settingsLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
