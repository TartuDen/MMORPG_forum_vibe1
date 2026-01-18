import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import '../styles/auth.css';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifying your email...');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing verification token.');
      setStatus('');
      return;
    }

    authAPI.verifyEmail(token)
      .then(() => {
        setStatus('Email verified. You can log in now.');
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Verification failed.');
        setStatus('');
      });
  }, [searchParams]);

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Email Verification</h2>
        {status && <div className="success-message">{status}</div>}
        {error && <div className="error-message">{error}</div>}
        <button type="button" className="submit-btn" onClick={() => navigate('/login')}>
          Go to Login
        </button>
      </div>
    </div>
  );
}
