import assert from 'node:assert/strict';
import http from 'node:http';
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret';
process.env.SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@example.com';
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

const postJson = async (path, payload, token = null) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  return { status: response.status, body };
};

const putJson = async (path, payload, token = null) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  return { status: response.status, body };
};

const deleteJson = async (path, token = null) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
};

const tests = [];

const runTest = (name, fn) => {
  tests.push({ name, fn });
};

let adminToken = null;

const ensureAdminToken = async () => {
  if (adminToken) return adminToken;
  const login = await postJson('/auth/login', { username: 'pomogA', password: 'Plot123123' });
  if (login.status !== 200) {
    throw new Error('Failed to login as admin');
  }
  adminToken = login.body.data.token;
  return adminToken;
};

runTest('registers a new user and logs in with email', async () => {
  const suffix = Date.now();
  const username = `tester_${suffix}`;
  const email = `tester_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await postJson('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });

  assert.equal(register.status, 201);
  assert.equal(register.body?.data?.user?.username, username);

  const login = await postJson('/auth/login', { email, password });
  assert.equal(login.status, 200);
  assert.ok(login.body?.data?.token);
});

runTest('logs in with username', async () => {
  const suffix = Date.now().toString().slice(-6);
  const username = `user_${suffix}`;
  const email = `user_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await postJson('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });

  assert.equal(register.status, 201);

  const login = await postJson('/auth/login', { username, password });
  assert.equal(login.status, 200);
  assert.ok(login.body?.data?.token);
});

runTest('admin creates, updates, and deletes a game', async () => {
  const token = await ensureAdminToken();
  const suffix = Date.now();
  const name = `Test Game ${suffix}`;

  const create = await postJson('/forums/games', {
    name,
    description: 'Initial description',
    tags: ['mmorpg', 'pvp'],
    icon_url: '',
    website_url: ''
  }, token);

  assert.equal(create.status, 201);
  const gameId = create.body?.data?.id;
  assert.ok(gameId);

  const update = await putJson(`/forums/games/${gameId}`, {
    name: `${name} Updated`,
    description: 'Updated description',
    tags: ['mmorpg', 'pve', 'pvp'],
    icon_url: 'https://example.com/icon.png',
    website_url: 'https://example.com'
  }, token);

  assert.equal(update.status, 200);

  const gamesResponse = await fetch(`${baseUrl}/forums/games/all`);
  const gamesBody = await gamesResponse.json();
  const updatedGame = gamesBody.data.find((game) => game.id === gameId);
  assert.equal(updatedGame.name, `${name} Updated`);
  assert.equal(updatedGame.description, 'Updated description');
  assert.equal(updatedGame.icon_url, 'https://example.com/icon.png');
  assert.equal(updatedGame.website_url, 'https://example.com');
  assert.equal(updatedGame.tags.length, 3);

  const remove = await deleteJson(`/forums/games/${gameId}`, token);
  assert.equal(remove.status, 200);
});

runTest('admin can promote and ban a user', async () => {
  const token = await ensureAdminToken();
  const suffix = Date.now();
  const username = `roleuser_${suffix}`.slice(0, 20);
  const email = `roleuser_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await postJson('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });
  assert.equal(register.status, 201);
  const userId = register.body?.data?.user?.id;
  assert.ok(userId);

  const promote = await putJson(`/users/${userId}/role`, { role: 'admin' }, token);
  assert.equal(promote.status, 200);
  assert.equal(promote.body?.data?.role, 'admin');

  const ban = await postJson(`/users/${userId}/ban`, { reason: 'Testing' }, token);
  assert.equal(ban.status, 200);

  const bannedLogin = await postJson('/auth/login', { email, password });
  assert.equal(bannedLogin.status, 403);
});

runTest('user can update profile, add thread, and delete own comment', async () => {
  const suffix = Date.now();
  const username = `user_${suffix}`.slice(0, 20);
  const email = `user_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await postJson('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });
  assert.equal(register.status, 201);
  const token = register.body?.data?.token;
  assert.ok(token);

  const updateProfile = await putJson('/auth/me', {
    bio: 'Testing profile update'
  }, token);
  assert.equal(updateProfile.status, 200);
  assert.equal(updateProfile.body?.data?.bio, 'Testing profile update');

  const forums = await fetch(`${baseUrl}/forums`);
  const forumsBody = await forums.json();
  const forumId = forumsBody?.data?.[0]?.id;
  assert.ok(forumId);

  const createThread = await postJson(`/forums/${forumId}/threads`, {
    title: 'Test Thread',
    content: 'Testing thread creation.'
  }, token);
  assert.equal(createThread.status, 201);
  const threadId = createThread.body?.data?.id;
  assert.ok(threadId);

  const createComment = await postJson(`/forums/${forumId}/threads/${threadId}/comments`, {
    content: 'My comment'
  }, token);
  assert.equal(createComment.status, 201);
  const commentId = createComment.body?.data?.id;
  assert.ok(commentId);

  const removeComment = await deleteJson(`/forums/${forumId}/threads/${threadId}/comments/${commentId}`, token);
  assert.equal(removeComment.status, 200);
});

runTest('thread can be deleted by admin only', async () => {
  const suffix = Date.now();
  const username = `ownthread_${suffix}`.slice(0, 20);
  const email = `ownthread_${suffix}@example.com`;
  const password = 'StrongPass1';

  const register = await postJson('/auth/register', {
    username,
    email,
    password,
    confirmPassword: password
  });
  assert.equal(register.status, 201);
  const token = register.body?.data?.token;
  assert.ok(token);

  const forums = await fetch(`${baseUrl}/forums`);
  const forumsBody = await forums.json();
  const forumId = forumsBody?.data?.[0]?.id;
  assert.ok(forumId);

  const createThread = await postJson(`/forums/${forumId}/threads`, {
    title: 'User thread',
    content: 'Thread for delete test.'
  }, token);
  assert.equal(createThread.status, 201);
  const threadId = createThread.body?.data?.id;
  assert.ok(threadId);

  const deleteByUser = await deleteJson(`/forums/${forumId}/threads/${threadId}`, token);
  assert.equal(deleteByUser.status, 403);

  const adminTokenValue = await ensureAdminToken();
  const deleteByAdmin = await deleteJson(`/forums/${forumId}/threads/${threadId}`, adminTokenValue);
  assert.equal(deleteByAdmin.status, 200);
});

runTest('rejects invalid usernames', async () => {
  const response = await postJson('/auth/register', {
    username: 'ab',
    email: 'shortname@example.com',
    password: 'StrongPass1',
    confirmPassword: 'StrongPass1'
  });

  assert.equal(response.status, 400);
  assert.equal(response.body?.code, 'INVALID_USERNAME');
});

runTest('rejects invalid emails', async () => {
  const response = await postJson('/auth/register', {
    username: 'valid_user',
    email: 'not-an-email',
    password: 'StrongPass1',
    confirmPassword: 'StrongPass1'
  });

  assert.equal(response.status, 400);
  assert.equal(response.body?.code, 'INVALID_EMAIL');
});

runTest('rejects weak passwords', async () => {
  const response = await postJson('/auth/register', {
    username: 'weak_pass_user',
    email: 'weakpass@example.com',
    password: 'short1A',
    confirmPassword: 'short1A'
  });

  assert.equal(response.status, 400);
  assert.equal(response.body?.code, 'WEAK_PASSWORD');
});

runTest('rejects mismatched confirm password', async () => {
  const response = await postJson('/auth/register', {
    username: 'mismatch_user',
    email: 'mismatch@example.com',
    password: 'StrongPass1',
    confirmPassword: 'StrongPass2'
  });

  assert.equal(response.status, 400);
  assert.equal(response.body?.code, 'PASSWORD_MISMATCH');
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
