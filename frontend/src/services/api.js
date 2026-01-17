import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          });

          localStorage.setItem('token', response.data.data.token);
          originalRequest.headers.Authorization = `Bearer ${response.data.data.token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
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
  refreshToken: (refreshToken) =>
    apiClient.post('/auth/refresh', { refreshToken }),
  getCurrentUser: () =>
    apiClient.get('/auth/me'),
  updateProfile: (updates) =>
    apiClient.put('/auth/me', updates)
};

// Users API
export const usersAPI = {
  getUser: (id) =>
    apiClient.get(`/users/${id}`),
  getUsers: (page = 1, limit = 10) =>
    apiClient.get(`/users?page=${page}&limit=${limit}`)
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
  createComment: (forumId, threadId, content) =>
    apiClient.post(`/forums/${forumId}/threads/${threadId}/comments`, { content }),
  updateComment: (forumId, threadId, commentId, content) =>
    apiClient.put(`/forums/${forumId}/threads/${threadId}/comments/${commentId}`, { content }),
  deleteComment: (forumId, threadId, commentId) =>
    apiClient.delete(`/forums/${forumId}/threads/${threadId}/comments/${commentId}`)
};

export default apiClient;
