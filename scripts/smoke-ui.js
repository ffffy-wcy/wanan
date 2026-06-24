const assert = require('assert');
const http = require('http');
const path = require('path');
const express = require('express');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(express.json());
app.use(express.static(ROOT));

let profileSaved = false;

app.post('/api/auth/email/send', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/email/login', (_req, res) => res.json({
  accessToken: 'fake-access',
  refreshToken: 'fake-refresh',
  user: {
    id: 'me',
    platform: 'email',
    nickname: '小好',
    email: 'lover@example.com',
    avatarUrl: '',
    gender: null,
    anniversary: null,
    matchCode: '30031163',
    hasProfile: false,
  },
}));
app.patch('/api/profile', (req, res) => {
  profileSaved = true;
  res.json({
    user: {
      id: 'me',
      platform: 'email',
      nickname: req.body.nickname,
      email: 'lover@example.com',
      avatarUrl: '',
      gender: req.body.gender,
      anniversary: req.body.anniversary,
      matchCode: '30031163',
      hasProfile: true,
    },
  });
});
app.get('/api/pair/code', (_req, res) => res.json({ matchCode: '30031163', qrToken: '30031163' }));
app.post('/api/pair/join', (_req, res) => res.json({
  room: { id: 'room1', userAId: 'me', userBId: 'ta', createdAt: new Date().toISOString() },
  partner: { id: 'ta', nickname: 'Ta', email: 'ta@example.com', hasProfile: true },
}));
app.get('/api/room/room1/wishes', (_req, res) => res.json({ wishes: [] }));
app.get('/api/room/room1/anniversaries', (_req, res) => res.json({ anniversaries: [] }));
app.get('/api/room/room1/moods', (_req, res) => res.json({ moods: [] }));
app.get('/api/room/room1/moments', (_req, res) => res.json({ moments: [] }));
app.get('/api/room/room1/settings', (_req, res) => res.json({
  settings: { meName: '小好', taName: 'Ta', sinceDate: '2026-06-03', nextMeetDate: '', locations: [] },
}));
app.get('/api/room/room1/location', (_req, res) => res.json({ locations: [] }));
app.put('/api/room/room1/location', (_req, res) => res.json({
  location: { id: 'loc1', roomId: 'room1', userId: 'me', lat: '29.56', lng: '106.55', city: '', battery: null, device: null },
}));
app.put('/api/room/room1/settings', (_req, res) => res.json({
  settings: { meName: '小好', taName: 'Ta', sinceDate: '2026-06-03', nextMeetDate: '', locations: [] },
}));

(async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('https://unpkg.com/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('https://cdn.socket.io/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.io=function(){return {emit(){},on(){},disconnect(){}}};' }));
    await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.qrcode=function(){return {addData(){},make(){},createImgTag(){return "<div data-test-qr>QR</div>"}}};',
    }));
    await page.route('https://wanan-8kqw.onrender.com/**', async (route) => {
      const req = route.request();
      const target = new URL(req.url());
      const response = await fetch(base + target.pathname + target.search, {
        method: req.method(),
        headers: {
          'content-type': req.headers()['content-type'] || 'application/json',
        },
        body: req.method() === 'GET' || req.method() === 'HEAD' ? undefined : req.postData(),
      });
      route.fulfill({
        status: response.status,
        contentType: response.headers.get('content-type') || 'application/json',
        body: await response.text(),
      });
    });

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition(success) { success({ coords: { latitude: 29.56, longitude: 106.55 } }); },
          watchPosition(success) { success({ coords: { latitude: 29.56, longitude: 106.55 } }); return 1; },
          clearWatch() {},
        },
        configurable: true,
      });
      navigator.permissions = { query: async () => ({ state: 'granted' }) };
    });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.getByText('下一页').click();
    await page.getByText('下一页').click();
    await page.getByText('开始').click();

    await page.getByPlaceholder('输入邮箱').fill('lover@q');
    await page.getByRole('option', { name: 'lover@qq.com' }).click();
    await page.getByPlaceholder('输入邮箱').fill('lover@example.com');
    await page.getByText('获取验证码').click();
    const codeBoxes = page.locator('.code-box');
    for (const [idx, digit] of Array.from('618308').entries()) {
      await codeBoxes.nth(idx).fill(digit);
    }
    await page.getByRole('button', { name: '登录', exact: true }).click();

    await page.getByPlaceholder('2-20 个字符').fill('小好');
    await page.getByText('Girl · 女').click();
    await page.locator('#profileAnniversary').fill('2026-06-03');
    await page.getByText('继续配对').click();

    await page.waitForSelector('#pairCodeValue');
    await page.locator('#joinCodeInput').fill('30031163');
    await page.getByRole('button', { name: '绑定' }).click();
    await page.getByRole('button', { name: '进入主页' }).click();

    await page.waitForSelector('.view-home.active');
    await page.getByRole('tab', { name: /状态/ }).click();
    await page.waitForSelector('#stPartnerDevice');

    assert.strictEqual(profileSaved, true);
    const title = await page.locator('#brandTitle').textContent();
    assert.ok(title.includes('小好'));
    console.log('smoke-ui: ok');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
