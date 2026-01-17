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

const postJson = async (path, payload) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  return { status: response.status, body };
};

const tests = [];

const runTest = (name, fn) => {
  tests.push({ name, fn });
};

runTest('registers a new user and logs in', async () => {
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
