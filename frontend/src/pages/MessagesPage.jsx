import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { authAPI, messagesAPI, searchAPI } from '../services/api';
import { useAuth } from '../services/authContext';
import '../styles/messages.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_IO_URL || 'http://localhost:5000';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleString();
};

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [startUserId, setStartUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [socketStatus, setSocketStatus] = useState('connecting');
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const socket = useMemo(() => {
    return io(SOCKET_URL, { withCredentials: true, autoConnect: false });
  }, []);

  const loadConversations = async () => {
    const response = await messagesAPI.listConversations();
    setConversations(response.data.data || []);
    if (!activeId && response.data.data?.length) {
      setActiveId(response.data.data[0].id);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) return;
    const response = await messagesAPI.listMessages(conversationId);
    setMessages(response.data.data || []);
    await messagesAPI.markRead(conversationId);
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
      )
    );
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        setLoading(true);
        const tokenResponse = await authAPI.getSocketToken();
        const token = tokenResponse.data?.data?.token;
        if (token) {
          socket.auth = { token };
          socket.connect();
        } else {
          setSocketStatus('disconnected');
        }

        await loadConversations();
        const userParam = searchParams.get('userId');
        if (userParam && !activeIdRef.current) {
          const targetId = parseInt(userParam, 10);
          if (targetId) {
            const response = await messagesAPI.createConversation(targetId);
            const conversationId = response.data.data.conversationId;
            await loadConversations();
            setActiveId(conversationId);
            setSearchParams({});
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.error || 'Failed to load conversations');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId).catch(() => {
      setError('Failed to load messages');
    });
  }, [activeId]);

  useEffect(() => {
    const handleNewMessage = (message) => {
      let found = false;
      setConversations((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((c) => c.id === message.conversation_id);
        if (idx >= 0) {
          found = true;
          updated[idx] = {
            ...updated[idx],
            last_message_body: message.body,
            last_message_at: message.created_at,
            unread_count: message.sender_id === user?.id
              ? updated[idx].unread_count
              : (updated[idx].unread_count || 0) + 1
          };
          return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
        }
        return updated;
      });

      if (!found) {
        loadConversations().catch(() => {});
      }

      if (message.conversation_id === activeIdRef.current) {
        setMessages((prev) => [...prev, message]);
        if (message.sender_id !== user?.id) {
          messagesAPI.markRead(message.conversation_id).catch(() => {});
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === message.conversation_id ? { ...conv, unread_count: 0 } : conv
            )
          );
        }
      }
    };

    socket.on('dm:new', handleNewMessage);
    socket.on('connect', () => setSocketStatus('connected'));
    socket.on('disconnect', () => setSocketStatus('disconnected'));
    socket.on('connect_error', () => setSocketStatus('disconnected'));

    return () => {
      socket.off('dm:new', handleNewMessage);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [socket]);

  const handleStartConversation = async (e) => {
    e.preventDefault();
    const targetId = parseInt(startUserId, 10);
    if (!targetId) {
      setError('Enter a valid user id');
      return;
    }

    try {
      setError('');
      const response = await messagesAPI.createConversation(targetId);
      const conversationId = response.data.data.conversationId;
      await loadConversations();
      setActiveId(conversationId);
      setStartUserId('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start conversation');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const response = await searchAPI.users(searchQuery.trim(), 1, 10);
      setSearchResults(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleStartFromSearch = async (targetId) => {
    try {
      setError('');
      const response = await messagesAPI.createConversation(targetId);
      const conversationId = response.data.data.conversationId;
      await loadConversations();
      setActiveId(conversationId);
      setSearchResults([]);
      setSearchQuery('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start conversation');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeId) return;
    try {
      setSending(true);
      const response = await messagesAPI.sendMessage(activeId, messageInput.trim());
      setMessages((prev) => [...prev, response.data.data]);
      setMessageInput('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="container"><p>Loading messages...</p></div>;
  }

  return (
    <div className="container">
      <div className="messages-layout">
        <aside className="messages-sidebar">
          <div className="messages-sidebar-header">
            <h2>Messages</h2>
            <div className={`socket-status ${socketStatus}`}>
              {socketStatus === 'connected' ? 'Realtime on' : 'Realtime off'}
            </div>
            <form className="start-convo" onSubmit={handleStartConversation}>
              <input
                type="text"
                value={startUserId}
                onChange={(e) => setStartUserId(e.target.value)}
                placeholder="User ID"
              />
              <button type="submit">Start</button>
            </form>
            <form className="search-users" onSubmit={handleSearch}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users"
              />
              <button type="submit" disabled={searching}>
                {searching ? '...' : 'Find'}
              </button>
            </form>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="search-result"
                    onClick={() => handleStartFromSearch(result.id)}
                  >
                    <span>{result.username}</span>
                    <span className="search-role">{result.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {conversations.length === 0 ? (
            <p className="empty-state">No conversations yet</p>
          ) : (
            <ul className="conversation-list">
              {conversations.map((conv) => {
                const isActive = conv.id === activeId;
                const unread = conv.last_message_at && (!conv.last_read_at || new Date(conv.last_read_at) < new Date(conv.last_message_at));
                return (
                  <li
                    key={conv.id}
                    className={`conversation-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveId(conv.id)}
                  >
                    <div className="conversation-avatar">
                      {conv.other_avatar_url ? (
                        <img src={conv.other_avatar_url} alt={conv.other_username} />
                      ) : (
                        <span>{conv.other_username?.charAt(0)?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-title">
                        <span>{conv.other_username}</span>
                        {unread && <span className="unread-dot">{conv.unread_count}</span>}
                      </div>
                      <div className="conversation-preview">
                        {conv.last_message_body || 'No messages yet'}
                      </div>
                    </div>
                    <div className="conversation-time">
                      {formatTime(conv.last_message_at)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="messages-panel">
          {error && <div className="error-message">{error}</div>}
          {!activeId ? (
            <div className="empty-state">Select a conversation to start</div>
          ) : (
            <>
              <div className="messages-header">
                <h3>Conversation</h3>
              </div>
              <div className="messages-list">
                {messages.length === 0 ? (
                  <div className="empty-state">No messages yet</div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`message-bubble ${msg.sender_id === user?.id ? 'outgoing' : 'incoming'}`}
                    >
                      <div className="message-body">{msg.body}</div>
                      <div className="message-meta">{formatTime(msg.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
              <form className="message-input" onSubmit={handleSend}>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                />
                <button type="submit" disabled={sending || !messageInput.trim()}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
