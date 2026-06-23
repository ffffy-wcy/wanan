require('dotenv').config();
const prisma = require('../db.js');
const auth = require('../middleware/auth.js');
const roomGuard = require('../middleware/roomGuard.js');
const router = require('express').Router({ mergeParams: true });

// GET /api/room/:roomId/location - 获取所有位置
router.get('/', auth, roomGuard, async (req, res) => {
  try {
    const locations = await prisma.location.findMany({
      where: { roomId: req.room.id }
    });
    return res.json({ locations });
  } catch (err) {
    return res.status(500).json({ error: '获取位置失败' });
  }
});

// PUT /api/room/:roomId/location - 更新当前用户位置
router.put('/', auth, roomGuard, async (req, res) => {
  try {
    const { city, lat, lng, battery, device } = req.body;

    const batteryStr = battery ? JSON.stringify(battery) : undefined;
    const deviceStr = device ? JSON.stringify(device) : undefined;

    // 查找现有记录
    const existing = await prisma.location.findFirst({
      where: {
        roomId: req.room.id,
        userId: req.user.id
      }
    });

    let location;
    if (existing) {
      location = await prisma.location.update({
        where: { id: existing.id },
        data: {
          city: city !== undefined ? city : existing.city,
          lat: lat !== undefined ? lat : existing.lat,
          lng: lng !== undefined ? lng : existing.lng,
          battery: batteryStr !== undefined ? batteryStr : existing.battery,
          device: deviceStr !== undefined ? deviceStr : existing.device
        }
      });
    } else {
      location = await prisma.location.create({
        data: {
          roomId: req.room.id,
          userId: req.user.id,
          city: city || '',
          lat: lat || '',
          lng: lng || '',
          battery: batteryStr || null,
          device: deviceStr || null
        }
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`room:${req.room.id}`).emit('location:update', { location });
    }

    return res.json({ location });
  } catch (err) {
    return res.status(500).json({ error: '更新位置失败' });
  }
});

module.exports = router;
