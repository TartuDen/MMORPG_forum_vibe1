import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { authAPI } from './api';
import { useAuth } from './authContext';

const PresenceContext = createContext({
  onlineUserIds: new Set(),
  status: 'disconnected'
});

const SOCKET_URL = import.meta.env.VITE_SOCKET_IO_URL || 'http://localhost:5000';

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
};

export const PresenceProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [status, setStatus] = useState('disconnected');

  const socket = useMemo(() => {
    return io(SOCKET_URL, { withCredentials: true, autoConnect: false });
  }, []);

  useEffect(() => {
    const handlePresenceUpdate = (payload) => {
      const ids = Array.isArray(payload?.userIds) ? payload.userIds : [];
      setOnlineUserIds(new Set(ids.map((id) => Number(id))));
    };

    socket.on('presence:update', handlePresenceUpdate);
    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('disconnected'));

    return () => {
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, [socket]);

  useEffect(() => {
    let active = true;

    const connectPresence = async () => {
      if (!isAuthenticated) {
        socket.disconnect();
        setOnlineUserIds(new Set());
        setStatus('disconnected');
        return;
      }

      try {
        const tokenResponse = await authAPI.getSocketToken();
        const token = tokenResponse.data?.data?.token;
        if (!active) return;
        if (token) {
          socket.auth = { token };
          socket.connect();
        } else {
          setStatus('disconnected');
        }
      } catch (err) {
        if (active) {
          setStatus('disconnected');
        }
      }
    };

    connectPresence();

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [isAuthenticated, socket]);

  return (
    <PresenceContext.Provider value={{ onlineUserIds, status }}>
      {children}
    </PresenceContext.Provider>
  );
};
