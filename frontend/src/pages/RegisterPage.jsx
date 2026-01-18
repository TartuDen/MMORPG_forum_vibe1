import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import '../styles/auth.css';
import { useState, useEffect, useRef } from 'react';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, loginWithGoogle, error: authError } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Watch for auth context errors
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleGoogleCredential = async (response) => {
    setError('');
    setLoading(true);

    try {
      await loginWithGoogle(response?.credential);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) {
      return undefined;
    }

    let intervalId;
    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) {
        return false;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320
      });
      return true;
    };

    if (!initializeGoogle()) {
      intervalId = setInterval(() => {
        if (initializeGoogle()) {
          clearInterval(intervalId);
        }
      }, 250);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [googleClientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const payload = await register(username, email, password);
      if (payload?.verificationUrl) {
        setSuccess(`Verification link (dev): ${payload.verificationUrl}`);
      } else {
        setSuccess('Check your email to verify your account.');
      }
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      // Error is already handled by authContext
      const errorMsg = err.response?.data?.error || 
                       err.response?.data?.message || 
                       err.message || 
                       'Registration failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Register</h2>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {googleClientId ? (
          <div className="google-auth">
            <div ref={googleButtonRef} className="google-button" />
            <div className="auth-divider">
              <span>or</span>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Choose a username (3-20 chars)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="At least 8 characters"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm your password"
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <a href="/login">Login here</a>
        </p>
      </div>
    </div>
  );
}
