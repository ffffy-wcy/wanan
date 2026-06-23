const prisma = require('../db');

async function roomGuard(req, res, next) {
  try {
    const roomId = req.params.roomId || req.params.id;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { userA: true, userB: true }
    });

    if (!room) {
      return res.status(403).json({ error: '无权访问该房间数据' });
    }

    if (req.user.id !== room.userAId && req.user.id !== room.userBId) {
      return res.status(403).json({ error: '无权访问该房间数据' });
    }

    req.room = room;
    next();
  } catch (err) {
    return res.status(403).json({ error: '无权访问该房间数据' });
  }
}

module.exports = roomGuard;