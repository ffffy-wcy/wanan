const assert = require('assert');
const http = require('http');
const path = require('path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const users = new Map();
let createCount = 0;

const dbPath = path.resolve(__dirname, '..', 'src', 'db.js');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    user: {
      async findUnique({ where }) {
        if (where.email) return users.get(where.email) || null;
        if (where.id) return Array.from(users.values()).find((user) => user.id === where.id) || null;
        return null;
      },
      async create({ data }) {
        createCount += 1;
        const user = {
          id: `user_${createCount}`,
          openId: null,
          phone: null,
          avatarUrl: '',
          gender: null,
          anniversary: null,
          matchCode: null,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.set(user.email, user);
        return user;
      },
    },
  },
};

const app = require('express')();
app.use(require('express').json());
const emailAuth = require('../src/routes/email-auth');
app.use('/api/auth/email', emailAuth);

function request(server, pathName, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path: pathName,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const server = app.listen(0);
  try {
    const email = 'lover@example.com';
    emailAuth.emailCodeStore.set(email, {
      code: '618308',
      expiresAt: Date.now() + 60_000,
      lastSentAt: Date.now(),
    });

    const res = await request(server, '/api/auth/email/login', { email, code: '618308' });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.accessToken, 'access token should be returned');
    assert.ok(res.body.refreshToken, 'refresh token should be returned');
    assert.strictEqual(res.body.user.email, email);
    assert.strictEqual(res.body.user.hasProfile, false);
    assert.strictEqual(emailAuth.emailCodeStore.has(email), false, 'used code should be deleted after success');

    const bad = await request(server, '/api/auth/email/login', { email: '', code: '123456' });
    assert.strictEqual(bad.status, 400);

    console.log('smoke-email-auth: ok');
  } finally {
    server.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
