import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/authContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForumPage from './pages/ForumPage';
import ThreadPage from './pages/ThreadPage';
import CreateThreadPage from './pages/CreateThreadPage';
import CreateForumPage from './pages/CreateForumPage';
import UserProfilePage from './pages/UserProfilePage';
import SearchPage from './pages/SearchPage';
import MessagesPage from './pages/MessagesPage';
import GameCategoryPage from './pages/GameCategoryPage';
import './App.css';

function ProtectedRoute({ children, isAuthenticated, loading }) {
  if (loading) {
    return <div className="container"><p>Loading...</p></div>;
  }
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="container"><p>Loading...</p></div>;
  }

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/" /> : <RegisterPage />}
        />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forums/:forumId" element={<ForumPage />} />
        <Route path="/forums/:forumId/threads/:threadId" element={<ThreadPage />} />
        <Route path="/games/category/:tag" element={<GameCategoryPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/user/:userId" element={<UserProfilePage />} />
        <Route
          path="/messages"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-forum"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
              <CreateForumPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forums/:forumId/create-thread"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} loading={loading}>
              <CreateThreadPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
