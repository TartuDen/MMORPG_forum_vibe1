import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
};

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add CSRF header to state-changing requests
apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (config.headers && config.headers['Content-Type']) {
      delete config.headers['Content-Type'];
    }
  }

  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// Handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';
    const isAuthCheck = requestUrl.includes('/auth/me');
    const isAuthAction = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/refresh')
      || requestUrl.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isAuthCheck || isAuthAction) {
        return Promise.reject(error);
      }
      originalRequest._retry = true;

      try {
        const csrfToken = getCookie('csrf_token');
        await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
          }
        );
        return apiClient(originalRequest);
      } catch (refreshError) {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (username, email, password) =>
    apiClient.post('/auth/register', { username, email, password }),
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }),
  refreshToken: () =>
    apiClient.post('/auth/refresh'),
  getCurrentUser: () =>
    apiClient.get('/auth/me'),
  getSocketToken: () =>
    apiClient.get('/auth/socket-token'),
  updateProfile: (updates) =>
    apiClient.put('/auth/me', updates),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiClient.post('/auth/me/avatar', formData);
  },
  logout: () =>
    apiClient.post('/auth/logout')
};

// Users API
export const usersAPI = {
  getUser: (id) =>
    apiClient.get(`/users/${id}`),
  getUsers: (page = 1, limit = 10) =>
    apiClient.get(`/users?page=${page}&limit=${limit}`)
};

export const searchAPI = {
  users: (query, page = 1, limit = 10) =>
    apiClient.get(`/search/users?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`)
};

// Forums API
export const forumsAPI = {
  getForums: (gameId = null) =>
    apiClient.get(`/forums${gameId ? `?gameId=${gameId}` : ''}`),
  getForum: (forumId, page = 1, limit = 10) =>
    apiClient.get(`/forums/${forumId}?page=${page}&limit=${limit}`),
  getGames: () =>
    apiClient.get('/forums/games/all'),
  createGame: (payload) =>
    apiClient.post('/forums/games', payload),
  updateGame: (gameId, payload) =>
    apiClient.put(`/forums/games/${gameId}`, payload),
  deleteForum: (forumId) =>
    apiClient.delete(`/forums/${forumId}`),
  createForum: (gameId, name, description) =>
    apiClient.post('/forums/create', { gameId, name, description })
};

// Threads API
export const threadsAPI = {
  getThread: (forumId, threadId, page = 1, limit = 10) =>
    apiClient.get(`/forums/${forumId}/threads/${threadId}?page=${page}&limit=${limit}`),
  createThread: (forumId, title, content, image_url = null) =>
    apiClient.post(`/forums/${forumId}/threads`, { title, content, image_url }),
  updateThread: (forumId, threadId, updates) =>
    apiClient.put(`/forums/${forumId}/threads/${threadId}`, updates),
  deleteThread: (forumId, threadId) =>
    apiClient.delete(`/forums/${forumId}/threads/${threadId}`)
};

// Comments API
export const commentsAPI = {
  createComment: (forumId, threadId, content, parentCommentId = null) =>
    apiClient.post(`/forums/${forumId}/threads/${threadId}/comments`, {
      content,
      parent_comment_id: parentCommentId
    }),
  updateComment: (forumId, threadId, commentId, content) =>
    apiClient.put(`/forums/${forumId}/threads/${threadId}/comments/${commentId}`, { content }),
  deleteComment: (forumId, threadId, commentId) =>
    apiClient.delete(`/forums/${forumId}/threads/${threadId}/comments/${commentId}`)
};

// Messaging API
export const messagesAPI = {
  listConversations: () =>
    apiClient.get('/messages/conversations'),
  createConversation: (userId) =>
    apiClient.post('/messages/conversations', { userId }),
  listMessages: (conversationId, page = 1, limit = 20) =>
    apiClient.get(`/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`),
  sendMessage: (conversationId, body) =>
    apiClient.post(`/messages/conversations/${conversationId}/messages`, { body }),
  markRead: (conversationId) =>
    apiClient.post(`/messages/conversations/${conversationId}/read`, {})
};

// Reputation API
export const reputationAPI = {
  getSettings: () =>
    apiClient.get('/reputation/settings'),
  updateSettings: (payload) =>
    apiClient.put('/reputation/settings', payload),
  voteThread: (threadId, value) =>
    apiClient.post(`/reputation/threads/${threadId}/vote`, { value }),
  voteComment: (commentId, value) =>
    apiClient.post(`/reputation/comments/${commentId}/vote`, { value })
};

export default apiClient;
