require('dotenv').config();
const prisma = require('../db.js');
const auth = require('../middleware/auth.js');
const roomGuard = require('../middleware/roomGuard.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = require('express').Router({ mergeParams: true });

// 确保 uploads 目录存在
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer 配置：存储到 uploads/ 目录
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|heic|heif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]);
    if (ext && mime) { cb(null, true); } else { cb(new Error('仅支持图片格式 (jpg, png, gif, webp, heic)')); }
  },
});

// 静态文件服务：让 uploads/ 目录可公开访问
router.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadsDir, req.path.replace(/^\/+/, ''));
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    next();
  }
});

// GET /api/room/:roomId/moments - 获取所有瞬间（按时间倒序）
router.get('/', auth, roomGuard, async (req, res) => {
  try {
    const moments = await prisma.moment.findMany({
      where: { roomId: req.room.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ moments });
  } catch (err) {
    return res.status(500).json({ error: '获取瞬间失败' });
  }
});

// POST /api/room/:roomId/moments - 上传照片创建瞬间
router.post('/', auth, roomGuard, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择一张照片' });
    }

    const imageUrl = '/api/room/' + req.params.roomId + '/moments/uploads/' + req.file.filename;
    const text = (req.body.text || '').slice(0, 500);
    const location = (req.body.location || '').slice(0, 200);
    const city = (req.body.city || '').slice(0, 50);
    const lat = (req.body.lat || '').slice(0, 20);
    const lng = (req.body.lng || '').slice(0, 20);

    const moment = await prisma.moment.create({
      data: {
        roomId: req.room.id,
        userId: req.user.id,
        imageUrl,
        text,
        location,
        city,
        lat,
        lng,
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to('room:' + req.room.id).emit('moment:new', { moment });
    }

    return res.json({ moment });
  } catch (err) {
    return res.status(500).json({ error: '创建瞬间失败' });
  }
});

// DELETE /api/room/:roomId/moments/:id - 删除瞬间（仅创建者可删）
router.delete('/:id', auth, roomGuard, async (req, res) => {
  try {
    const moment = await prisma.moment.findUnique({ where: { id: req.params.id } });
    if (!moment) return res.status(404).json({ error: '瞬间不存在' });
    if (moment.userId !== req.user.id) return res.status(403).json({ error: '只能删除自己发布的瞬间' });

    // 删除关联的图片文件
    const filename = moment.imageUrl.split('/').pop();
    if (filename) {
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.moment.delete({ where: { id: req.params.id } });

    const io = req.app.get('io');
    if (io) {
      io.to('room:' + req.room.id).emit('moment:delete', { momentId: req.params.id });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: '删除瞬间失败' });
  }
});

module.exports = router;