/* 晚安 · 数据同步后端
   - Node.js + Express
   - 数据存储：./data/<room>.json（简单 JSON 文件，SQLite 对这个量级是过度设计）
   - 认证：仅靠「房间号（room code）」作为共享密码
   - 启动：node server.js   （默认端口 3000）
*/

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// 确保 data 目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// 静态文件（用于本地开发时同时提供前端 + 后端）
app.use(express.static(__dirname));

// ========== 工具 ==========

const roomFile = (room) => path.join(DATA_DIR, `${encodeURIComponent(room)}.json`);

function loadRoom(room) {
  const file = roomFile(room);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function saveRoom(room, data) {
  const file = roomFile(room);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// 简单房间号合法性校验
function validRoom(room) {
  return typeof room === 'string' && room.length >= 2 && room.length <= 80;
}

function defaultData() {
  return {
    meName: 'LH',
    taName: 'WCY',
    sinceDate: '2026-04-25',
    nextMeetDate: '',
    meLat: '',
    meLng: '',
    taLat: '',
    taLng: '',
    wall: [],
    wishes: [],
    anniversaries: [],
    moods: [],
    updatedAt: Date.now(),
  };
}

// ========== API ==========

// 读取整个房间数据
app.get('/api/data/:room', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const data = loadRoom(req.params.room);
  if (!data) return res.status(404).json({ error: 'not found' });
  res.json(data);
});

// 创建或全量覆盖房间数据
app.put('/api/data/:room', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const incoming = req.body || {};
  const data = {
    ...defaultData(),
    ...incoming,
    updatedAt: Date.now(),
  };
  saveRoom(req.params.room, data);
  res.json({ ok: true, updatedAt: data.updatedAt });
});

// 增量更新（更安全：只更新传入的字段）
app.patch('/api/data/:room', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const current = loadRoom(req.params.room) || defaultData();
  const patch = req.body || {};
  Object.keys(patch).forEach((k) => {
    current[k] = patch[k];
  });
  current.updatedAt = Date.now();
  saveRoom(req.params.room, current);
  res.json({ ok: true, updatedAt: current.updatedAt });
});

// —— 时光墙 ——
app.post('/api/wall/:room', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const data = loadRoom(req.params.room) || defaultData();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    who: String(req.body.who || 'me'),
    text: String(req.body.text || '').slice(0, 500),
    date: String(req.body.date || new Date().toISOString().slice(0, 10)),
    createdAt: Date.now(),
  };
  data.wall.unshift(entry);
  data.updatedAt = Date.now();
  saveRoom(req.params.room, data);
  res.json({ ok: true, entry });
});

app.delete('/api/wall/:room/:id', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const data = loadRoom(req.params.room) || defaultData();
  data.wall = data.wall.filter((x) => x.id !== req.params.id);
  data.updatedAt = Date.now();
  saveRoom(req.params.room, data);
  res.json({ ok: true });
});

// —— 心愿清单 ——
app.post('/api/wishes/:room', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const data = loadRoom(req.params.room) || defaultData();
  const wish = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text: String(req.body.text || '').slice(0, 200),
    done: !!req.body.done,
    createdAt: Date.now(),
  };
  data.wishes.push(wish);
  data.updatedAt = Date.now();
  saveRoom(req.params.room, data);
  res.json({ ok: true, wish });
});

app.patch('/api/wishes/:room/:id', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const data = loadRoom(req.params.room) || defaultData();
  const wish = data.wishes.find((x) => x.id === req.params.id);
  if (!wish) return res.status(404).json({ error: 'not found' });
  if (typeof req.body.done === 'boolean') wish.done = req.body.done;
  if (typeof req.body.text === 'string') wish.text = req.body.text.slice(0, 200);
  data.updatedAt = Date.now();
  saveRoom(req.params.room, data);
  res.json({ ok: true, wish });
});

app.delete('/api/wishes/:room/:id', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const data = loadRoom(req.params.room) || defaultData();
  data.wishes = data.wishes.filter((x) => x.id !== req.params.id);
  data.updatedAt = Date.now();
  saveRoom(req.params.room, data);
  res.json({ ok: true });
});

// —— 纪念日 ——
app.post('/api/anniv/:room', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const data = loadRoom(req.params.room) || defaultData();
  const anniv = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: String(req.body.name || '纪念日').slice(0, 40),
    date: String(req.body.date || new Date().toISOString().slice(0, 10)),
    createdAt: Date.now(),
  };
  data.anniversaries.push(anniv);
  data.updatedAt = Date.now();
  saveRoom(req.params.room, data);
  res.json({ ok: true, anniv });
});

app.delete('/api/anniv/:room/:id', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const data = loadRoom(req.params.room) || defaultData();
  data.anniversaries = data.anniversaries.filter((x) => x.id !== req.params.id);
  data.updatedAt = Date.now();
  saveRoom(req.params.room, data);
  res.json({ ok: true });
});

// —— 心情打卡 ——
app.post('/api/mood/:room', (req, res) => {
  if (!validRoom(req.params.room)) return res.status(400).json({ error: 'bad room' });
  const data = loadRoom(req.params.room) || defaultData();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    level: Number(req.body.level) || 3,
    date: String(req.body.date || new Date().toISOString().slice(0, 10)),
    note: String(req.body.note || '').slice(0, 200),
    createdAt: Date.now(),
  };
  // 同一天如果已经有记录则覆盖，否则新增
  const idx = data.moods.findIndex((m) => m.date === entry.date);
  if (idx >= 0) data.moods[idx] = entry;
  else data.moods.unshift(entry);
  data.moods = data.moods.slice(0, 90); // 最多保留 90 天
  data.updatedAt = Date.now();
  saveRoom(req.params.room, data);
  res.json({ ok: true, entry });
});

// 健康检查
app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));

app.listen(PORT, () => {
  console.log(`✅ 晚安 · 后端已启动`);
  console.log(`   本地访问: http://localhost:${PORT}`);
  console.log(`   数据目录: ${DATA_DIR}`);
});
