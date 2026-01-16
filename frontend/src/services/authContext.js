import { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from './api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await authAPI.getCurrentUser();
          setUser(response.data.data);
        } catch (err) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const register = async (username, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.register(username, email, password);
      const { user, token, refreshToken } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(user);

      return user;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.login(email, password);
      const { user, token, refreshToken } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(user);

      return user;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const updateProfile = async (updates) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.updateProfile(updates);
      setUser(response.data.data);
      return response.data.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Update failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        register,
        login,
        logout,
        updateProfile,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
