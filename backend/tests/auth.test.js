import assert from 'node:assert/strict';
import http from 'node:http';
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';
process.env.SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@example.com';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.DB_NAME || 'mmorpg_forum';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? '';
process.env.PGPASSWORD = String(process.env.DB_PASSWORD ?? '');

const { initializeDatabase } = await import('../src/db/init.js');
const { default: app } = await import('../src/app.js');
const { default: pool } = await import('../src/db/connection.js');

await initializeDatabase();

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}/api`;

const createClient = () => {
  const jar = {};

  const buildCookieHeader = () => {
    const entries = Object.entries(jar);
    if (entries.length === 0) return '';
    return entries.map(([key, value]) => `${key}=${value}`).join('; ');
  };

  const updateCookies = (setCookieHeader) => {
    if (!setCookieHeader) return;
    const cookieParts = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader.split(/,(?=[^;]+=[^;]+)/);
    for (const part of cookieParts) {
      const [pair] = part.split(';');
      const [name, value] = pair.trim().split('=');
      if (name) {
        jar[name] = value ?? '';
      }
    }
  };

  const request = async (method, path, payload) => {
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
    }
    const cookieHeader = buildCookieHeader();
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (jar.csrf_token) {
        headers['X-CSRF-Token'] = jar.csrf_token;
      }
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined
    });

    if (typeof response.headers.getSetCookie === 'function') {
      updateCookies(response.headers.getSetCookie());
    } else {
      updateCookies(response.headers.get('set-cookie'));
    }
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  };

  const requestForm = async (method, path, formData) => {
    const headers = {};
    const cookieHeader = buildCookieHeader();
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (jar.csrf_token) {
        headers['X-CSRF-Token'] = jar.csrf_token;
      }
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: formData
    });

    if (typeof response.headers.getSetCookie === 'function') {
      updateCookies(response.headers.getSetCookie());
    } else {
      updateCookies(response.headers.get('set-cookie'));
    }
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  };

  return {
    get: (path) => request('GET', path),
    post: (path, payload) => request('POST', path, payload),
    put: (path, payload) => request('PUT', path, payload),
    delete: (path) => request('DELETE', path),
    postForm: (path, formData) => requestForm('POST', path, formData)
  };
};

const tests = [];

const runTest = (name, fn) => {
  tests.push({ name, fn });
};

let adminClient = null;

const ensureAdminClient = async () => {
  if (adminClient) return adminClient;
  adminClient = createClient();
  const login = await adminClient.post('/auth/login', { username: 'pomogA', password: 'Plot123123' });
  if (login.status !== 200) {
    throw new Error('Failed to login as admin');
  }
  return adminClient;
};

runTest('registers a new user and logs in with email', async () => {
  const client = createClient();
  const suffix = Date.now();
  const username = `tester_${suffix}`;
  const email = `tester_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await client.post('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });

  assert.equal(register.status, 201);
  assert.equal(register.body?.data?.user?.username, username);

  const login = await client.post('/auth/login', { email, password });
  assert.equal(login.status, 200);
  assert.ok(login.body?.data?.user?.id);
});

runTest('sets basic security headers', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  const headers = response.headers;
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('referrer-policy'), 'no-referrer');
  assert.equal(headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
  assert.ok(headers.get('content-security-policy'));
});

runTest('adds CORS headers for allowed origins', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'http://localhost:5173' }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
});

runTest('rejects disallowed origin for state-changing requests', async () => {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://evil.example.com'
    },
    body: JSON.stringify({
      username: `evil_${Date.now()}`,
      email: `evil_${Date.now()}@example.com`,
      password: 'StrongPass1',
      confirmPassword: 'StrongPass1'
    })
  });

  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body?.code, 'ORIGIN_NOT_ALLOWED');
});

runTest('logs in with username', async () => {
  const client = createClient();
  const suffix = Date.now().toString().slice(-6);
  const username = `user_${suffix}`;
  const email = `user_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await client.post('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });

  assert.equal(register.status, 201);

  const login = await client.post('/auth/login', { username, password });
  assert.equal(login.status, 200);
  assert.ok(login.body?.data?.user?.id);
});

runTest('admin creates, updates, and deletes a game', async () => {
  const admin = await ensureAdminClient();
  const suffix = Date.now();
  const name = `Test Game ${suffix}`;

  const create = await admin.post('/forums/games', {
    name,
    description: 'Initial description',
    tags: ['mmorpg', 'pvp'],
    icon_url: '',
    website_url: ''
  });

  assert.equal(create.status, 201);
  const gameId = create.body?.data?.id;
  assert.ok(gameId);

  const update = await admin.put(`/forums/games/${gameId}`, {
    name: `${name} Updated`,
    description: 'Updated description',
    tags: ['mmorpg', 'pve', 'pvp'],
    icon_url: 'https://example.com/icon.png',
    website_url: 'https://example.com'
  });

  assert.equal(update.status, 200);

  const gamesResponse = await fetch(`${baseUrl}/forums/games/all`);
  const gamesBody = await gamesResponse.json();
  const updatedGame = gamesBody.data.find((game) => game.id === gameId);
  assert.equal(updatedGame.name, `${name} Updated`);
  assert.equal(updatedGame.description, 'Updated description');
  assert.equal(updatedGame.icon_url, 'https://example.com/icon.png');
  assert.equal(updatedGame.website_url, 'https://example.com');
  assert.equal(updatedGame.tags.length, 3);

  const remove = await admin.delete(`/forums/games/${gameId}`);
  assert.equal(remove.status, 200);
});

runTest('admin can promote and ban a user', async () => {
  const admin = await ensureAdminClient();
  const client = createClient();
  const suffix = Date.now();
  const username = `roleuser_${suffix}`.slice(0, 20);
  const email = `roleuser_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await client.post('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });
  assert.equal(register.status, 201);
  const userId = register.body?.data?.user?.id;
  assert.ok(userId);

  const promote = await admin.put(`/users/${userId}/role`, { role: 'admin' });
  assert.equal(promote.status, 200);
  assert.equal(promote.body?.data?.role, 'admin');

  const ban = await admin.post(`/users/${userId}/ban`, { reason: 'Testing' });
  assert.equal(ban.status, 200);

  const bannedClient = createClient();
  const bannedLogin = await bannedClient.post('/auth/login', { email, password });
  assert.equal(bannedLogin.status, 403);
});

runTest('user can update profile, add thread, and delete own comment', async () => {
  const client = createClient();
  const suffix = Date.now();
  const username = `user_${suffix}`.slice(0, 20);
  const email = `user_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await client.post('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });
  assert.equal(register.status, 201);
  assert.ok(register.body?.data?.user?.id);

  const updateProfile = await client.put('/auth/me', {
    bio: 'Testing profile update'
  });
  assert.equal(updateProfile.status, 200);
  assert.equal(updateProfile.body?.data?.bio, 'Testing profile update');

  const forums = await client.get('/forums');
  const forumsBody = forums.body;
  const forumId = forumsBody?.data?.[0]?.id;
  assert.ok(forumId);

  const createThread = await client.post(`/forums/${forumId}/threads`, {
    title: 'Test Thread',
    content: 'Testing thread creation.'
  });
  assert.equal(createThread.status, 201);
  const threadId = createThread.body?.data?.id;
  assert.ok(threadId);

  const createComment = await client.post(`/forums/${forumId}/threads/${threadId}/comments`, {
    content: 'My comment'
  });
  assert.equal(createComment.status, 201);
  const commentId = createComment.body?.data?.id;
  assert.ok(commentId);

  const removeComment = await client.delete(`/forums/${forumId}/threads/${threadId}/comments/${commentId}`);
  assert.equal(removeComment.status, 200);

  const admin = await ensureAdminClient();
  const deleteThread = await admin.delete(`/forums/${forumId}/threads/${threadId}`);
  assert.equal(deleteThread.status, 200);
});

runTest('thread can be deleted by admin only', async () => {
  const client = createClient();
  const suffix = Date.now();
  const username = `ownthread_${suffix}`.slice(0, 20);
  const email = `ownthread_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await client.post('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });
  assert.equal(register.status, 201);
  assert.ok(register.body?.data?.user?.id);

  const forums = await client.get('/forums');
  const forumsBody = forums.body;
  const forumId = forumsBody?.data?.[0]?.id;
  assert.ok(forumId);

  const createThread = await client.post(`/forums/${forumId}/threads`, {
    title: 'User thread',
    content: 'Thread for delete test.'
  });
  assert.equal(createThread.status, 201);
  const threadId = createThread.body?.data?.id;
  assert.ok(threadId);

  const deleteByUser = await client.delete(`/forums/${forumId}/threads/${threadId}`);
  assert.equal(deleteByUser.status, 403);

  const admin = await ensureAdminClient();
  const deleteByAdmin = await admin.delete(`/forums/${forumId}/threads/${threadId}`);
  assert.equal(deleteByAdmin.status, 200);
});

runTest('rejects invalid usernames', async () => {
  const client = createClient();
  const response = await client.post('/auth/register', {
    username: 'ab',
    email: 'shortname@example.com',
    password: 'StrongPass1',
    confirmPassword: 'StrongPass1'
  });

  assert.equal(response.status, 400);
  assert.equal(response.body?.code, 'INVALID_USERNAME');
});

runTest('rejects invalid emails', async () => {
  const client = createClient();
  const response = await client.post('/auth/register', {
    username: 'valid_user',
    email: 'not-an-email',
    password: 'StrongPass1',
    confirmPassword: 'StrongPass1'
  });

  assert.equal(response.status, 400);
  assert.equal(response.body?.code, 'INVALID_EMAIL');
});

runTest('rejects weak passwords', async () => {
  const client = createClient();
  const response = await client.post('/auth/register', {
    username: 'weak_pass_user',
    email: 'weakpass@example.com',
    password: 'short1A',
    confirmPassword: 'short1A'
  });

  assert.equal(response.status, 400);
  assert.equal(response.body?.code, 'WEAK_PASSWORD');
});

runTest('rejects mismatched confirm password', async () => {
  const client = createClient();
  const response = await client.post('/auth/register', {
    username: 'mismatch_user',
    email: 'mismatch@example.com',
    password: 'StrongPass1',
    confirmPassword: 'StrongPass2'
  });

  assert.equal(response.status, 400);
  assert.equal(response.body?.code, 'PASSWORD_MISMATCH');
});

runTest('locks account after repeated failed logins', async () => {
  const client = createClient();
  const suffix = Date.now();
  const username = `lockuser_${suffix}`.slice(0, 20);
  const email = `lockuser_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await client.post('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });
  assert.equal(register.status, 201);

  for (let i = 0; i < 5; i++) {
    const attempt = await client.post('/auth/login', {
      email,
      password: 'WrongPass1'
    });
    assert.equal(attempt.status, 401);
  }

  const locked = await client.post('/auth/login', { email, password });
  assert.equal(locked.status, 403);
  assert.equal(locked.body?.code, 'ACCOUNT_LOCKED');
});

runTest('rejects oversized thread content', async () => {
  const client = createClient();
  const suffix = Date.now();
  const username = `longthread_${suffix}`.slice(0, 20);
  const email = `longthread_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await client.post('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });
  assert.equal(register.status, 201);

  const forums = await client.get('/forums');
  const forumId = forums.body?.data?.[0]?.id;
  assert.ok(forumId);

  const createThread = await client.post(`/forums/${forumId}/threads`, {
    title: 'Oversized content',
    content: 'a'.repeat(5001)
  });

  assert.equal(createThread.status, 400);
  assert.equal(createThread.body?.code, 'CONTENT_TOO_LONG');
});

runTest('uploads avatar image and stores data URL', async () => {
  const client = createClient();
  const suffix = Date.now();
  const username = `avatar_${suffix}`.slice(0, 20);
  const email = `avatar_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await client.post('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });
  assert.equal(register.status, 201);

  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X3Jt8AAAAASUVORK5CYII=';
  const buffer = Buffer.from(pngBase64, 'base64');
  const form = new FormData();
  form.append('avatar', new Blob([buffer], { type: 'image/png' }), 'avatar.png');

  const upload = await client.postForm('/auth/me/avatar', form);
  assert.equal(upload.status, 200);
  assert.ok(upload.body?.data?.avatar_url?.startsWith('data:image/png;base64,'));
});

const run = async () => {
  let failures = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }

  await new Promise((resolve) => server.close(resolve));
  await pool.end();

  if (failures > 0) {
    process.exitCode = 1;
  }
};

await run();
