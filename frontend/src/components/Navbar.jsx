import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { searchAPI } from '../services/api';
import '../styles/navbar.css';

const MIN_SEARCH_LENGTH = 4;
const SUGGESTION_LIMIT = 8;
const SUGGESTION_DEBOUNCE_MS = 300;

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchError, setSearchError] = useState('');
  const searchRef = useRef(null);
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const clearSearchState = () => {
    setSearchQuery('');
    setSuggestions([]);
    setSuggestionsOpen(false);
    setSuggestionsLoading(false);
    setActiveIndex(-1);
    setSearchError('');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setSearchError(`Enter at least ${MIN_SEARCH_LENGTH} characters to search`);
      return;
    }
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    clearSearchState();
  };

  const handleSuggestionClick = (suggestion) => {
    navigate(suggestion.path);
    clearSearchState();
  };

  const handleKeyDown = (event) => {
    if (!suggestionsOpen || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      handleSuggestionClick(suggestions[activeIndex]);
      return;
    }
    if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSuggestionsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestionsLoading(false);
      setActiveIndex(-1);
      return undefined;
    }

    setSuggestionsLoading(true);
    const timerId = setTimeout(async () => {
      try {
        const response = await searchAPI.suggestions(trimmed, SUGGESTION_LIMIT);
        const data = response.data?.data || [];
        setSuggestions(data);
        setSuggestionsOpen(true);
      } catch (err) {
        setSuggestions([]);
        setSuggestionsOpen(false);
      } finally {
        setSuggestionsLoading(false);
      }
    }, SUGGESTION_DEBOUNCE_MS);

    return () => clearTimeout(timerId);
  }, [searchQuery]);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <h1 onClick={() => navigate('/')}>
            <img src="/favicon.svg" alt="Not-A-Forum logo" className="navbar-logo" />
            <span>Not-A-Forum</span>
          </h1>
        </div>

        {isAuthenticated && (
          <form className="navbar-search" onSubmit={handleSearch} ref={searchRef}>
            <div className="search-field">
              <input
                type="text"
                placeholder="Search threads, comments, users..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchError('');
                  setActiveIndex(-1);
                }}
                onFocus={() => {
                  if (searchQuery.trim().length >= MIN_SEARCH_LENGTH) {
                    setSuggestionsOpen(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                className="search-input"
                aria-autocomplete="list"
                aria-expanded={suggestionsOpen}
              />
              {suggestionsOpen && (
                <div className="search-suggestions">
                  {suggestionsLoading ? (
                    <div className="search-suggestion muted">Searching...</div>
                  ) : suggestions.length === 0 ? (
                    <div className="search-suggestion muted">No suggestions</div>
                  ) : (
                    suggestions.map((suggestion, index) => (
                      <button
                        type="button"
                        key={`${suggestion.type}-${suggestion.label}-${index}`}
                        className={`search-suggestion ${index === activeIndex ? 'active' : ''}`}
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <span className="suggestion-label">{suggestion.label}</span>
                        <span className="suggestion-type">{suggestion.type}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {searchError && <div className="search-error">{searchError}</div>}
            </div>
            <button type="submit" className="search-btn">Search</button>
          </form>
        )}

        <div className="navbar-menu">
          {isAuthenticated ? (
            <>
              <span 
                className="navbar-user" 
                onClick={() => navigate(`/user/${user?.id}`)}
                style={{ cursor: 'pointer' }}
              >
                Welcome, {user?.username}!
              </span>
              <button
                onClick={() => navigate('/users')}
                className="navbar-btn login-btn"
              >
                Users
              </button>
              <button
                onClick={() => navigate('/messages')}
                className="navbar-btn login-btn"
              >
                Messages
              </button>
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin/users')}
                  className="navbar-btn register-btn"
                >
                  Admin
                </button>
              )}
              <button onClick={handleLogout} className="navbar-btn logout-btn">
                Logout
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="navbar-btn login-btn">
                Login
              </button>
              <button onClick={() => navigate('/register')} className="navbar-btn register-btn">
                Register
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
