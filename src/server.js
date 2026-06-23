require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { initSocket } = require('./sync');

const authRoutes = require('./routes/auth');
const smsAuthRoutes = require('./routes/sms-auth');
const emailAuthRoutes = require('./routes/email-auth');
const profileRoutes = require('./routes/profile');
const pairRoutes = require('./routes/pair');
const wishRoutes = require('./routes/wish');
const anniversaryRoutes = require('./routes/anniversary');
const moodRoutes = require('./routes/mood');
const settingsRoutes = require('./routes/settings');
const locationRoutes = require('./routes/location');
const momentRoutes = require('./routes/moments');
const exportRoutes = require('./routes/export');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/sms', smsAuthRoutes);
app.use('/api/auth/email', emailAuthRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/pair', pairRoutes);
app.use('/api/room/:roomId/wishes', wishRoutes);
app.use('/api/room/:roomId/anniversaries', anniversaryRoutes);
app.use('/api/room/:roomId/moods', moodRoutes);
app.use('/api/room/:roomId/settings', settingsRoutes);
app.use('/api/room/:roomId/location', locationRoutes);
app.use('/api/room/:roomId/moments', momentRoutes);
app.use('/api', exportRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

const server = http.createServer(app);
const io = initSocket(server);
app.set('io', io);

server.listen(PORT, () => {
  console.log(`✅ 晚安 · 后端已启动`);
  console.log(`   本地访问: http://localhost:${PORT}`);
});