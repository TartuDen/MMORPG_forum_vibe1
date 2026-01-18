import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { authAPI } from '../services/api';
import '../styles/auth.css';
import { useEffect, useRef, useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resendStatus, setResendStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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
    setResendStatus('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setResendStatus('Enter your email to resend verification.');
      return;
    }
    setResendStatus('Sending verification email...');
    try {
      const response = await authAPI.resendVerification(email.trim());
      const devUrl = response.data?.data?.verificationUrl;
      if (devUrl) {
        setResendStatus(`Verification link (dev): ${devUrl}`);
      } else {
        setResendStatus('Check your email for a verification link.');
      }
    } catch (err) {
      setResendStatus(err.response?.data?.error || 'Failed to resend verification.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Login</h2>

        {error && <div className="error-message">{error}</div>}
        {resendStatus && <div className="success-message">{resendStatus}</div>}

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
            <label htmlFor="email">Email or Username</label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email or username"
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
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {error && error.includes('verify your email') && (
          <button type="button" className="secondary-btn" onClick={handleResendVerification}>
            Resend verification email
          </button>
        )}

        <p className="auth-link">
          Don't have an account? <a href="/register">Register here</a>
        </p>
      </div>
    </div>
  );
}
