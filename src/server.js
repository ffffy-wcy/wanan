const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');

require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_err) {
    return '';
  }
}

function getDatasourceProvider(schemaText) {
  const match = schemaText.match(/provider\s*=\s*"([^"]+)"/);
  return match ? match[1] : '';
}

function runPrisma(args) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npx, ['prisma', ...args], {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: 'inherit'
  });
}

function validateRuntimeEnv() {
  const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
  const missing = requiredEnvVars.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`Error: Missing required environment variable(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL)) {
    console.error('Error: DATABASE_URL must be a PostgreSQL connection string for the current Prisma schema.');
    console.error('Example: postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public');
    process.exit(1);
  }
}

function preparePrismaRuntime() {
  const appSchemaPath = path.join(ROOT_DIR, 'prisma', 'schema.prisma');
  const generatedSchemaPath = path.join(ROOT_DIR, 'node_modules', '.prisma', 'client', 'schema.prisma');
  const appSchema = readFileSafe(appSchemaPath);
  let generatedSchema = readFileSafe(generatedSchemaPath);
  const appProvider = getDatasourceProvider(appSchema);
  let generatedProvider = getDatasourceProvider(generatedSchema);

  if (appProvider !== 'postgresql') {
    console.error(`Error: prisma/schema.prisma must use postgresql, got ${appProvider || 'unknown'}.`);
    process.exit(1);
  }

  if (generatedProvider !== appProvider) {
    console.warn(`Prisma client is stale or missing (generated provider: ${generatedProvider || 'unknown'}). Running prisma generate...`);
    runPrisma(['generate']);
    generatedSchema = readFileSafe(generatedSchemaPath);
    generatedProvider = getDatasourceProvider(generatedSchema);
  }

  if (generatedProvider !== appProvider) {
    console.error(`Error: Prisma client provider is ${generatedProvider || 'unknown'} after generate, expected ${appProvider}.`);
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && process.env.SKIP_PRISMA_MIGRATE !== '1') {
    runPrisma(['migrate', 'deploy']);
  }
}

validateRuntimeEnv();
preparePrismaRuntime();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { initSocket } = require('./sync');

const authRoutes = require('./routes/auth');
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

app.use('/api/auth', authRoutes);
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'goodnight', dbProvider: 'postgresql', t: Date.now() });
});

app.use(express.static(ROOT_DIR));

const server = http.createServer(app);
const io = initSocket(server);
app.set('io', io);

server.listen(PORT, () => {
  console.log('goodnight backend started');
  console.log(`Local URL: http://localhost:${PORT}`);
});
