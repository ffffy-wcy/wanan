require('dotenv').config();
const { Router } = require('express');
const prisma = require('../db.js');
const auth = require('../middleware/auth.js');

const router = Router();

function hasProfile(user) {
  return !!(user.nickname && user.gender && user.anniversary);
}

function userPublic(user) {
  return {
    id: user.id,
    platform: user.platform,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    email: user.email,
    gender: user.gender,
    anniversary: user.anniversary,
    matchCode: user.matchCode,
    hasProfile: hasProfile(user)
  };
}

function roomPublic(room) {
  return {
    id: room.id,
    userAId: room.userAId,
    userBId: room.userBId,
    createdAt: room.createdAt
  };
}

// 将字符串哈希为 8 位可读数字（10000000 ~ 99999999）
function hashToCode(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return String((hash % 90000000) + 10000000);
}

async function ensureMatchCode(user) {
  if (user.matchCode) return user.matchCode;

  let salt = '';
  let attempts = 0;
  while (attempts < 100) {
    const candidate = hashToCode(user.id + salt);
    const existing = await prisma.user.findUnique({ where: { matchCode: candidate } });
    if (!existing) {
      await prisma.user.update({
        where: { id: user.id },
        data: { matchCode: candidate }
      });
      return candidate;
    }
    salt = `_${attempts}`;
    attempts++;
  }
  throw new Error('无法生成唯一匹配码');
}

// GET /api/pair/code
router.get('/code', auth, async (req, res) => {
  try {
    const matchCode = await ensureMatchCode(req.user);
    return res.json({ matchCode, qrToken: matchCode });
  } catch (err) {
    console.error('Pair code error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/pair/join
router.post('/join', auth, async (req, res) => {
  try {
    const { matchCode } = req.body;
    if (!matchCode || !/^\d{6,8}$/.test(String(matchCode))) {
      return res.status(400).json({ error: '匹配码格式不正确' });
    }

    if (req.user.partnerId) {
      return res.status(400).json({ error: '你已配对，请先解除当前配对' });
    }

    const existingRoom = await prisma.room.findFirst({
      where: { OR: [{ userAId: req.user.id }, { userBId: req.user.id }] }
    });
    if (existingRoom) {
      return res.status(400).json({ error: '你已配对，请先解除当前配对' });
    }

    const partner = await prisma.user.findUnique({ where: { matchCode: String(matchCode) } });
    if (!partner) {
      return res.status(400).json({ error: '匹配码无效' });
    }
    if (partner.id === req.user.id) {
      return res.status(400).json({ error: '不能与自己配对' });
    }
    if (partner.partnerId && partner.partnerId !== req.user.id) {
      return res.status(400).json({ error: '对方已与其他人配对' });
    }

    const partnerRoom = await prisma.room.findFirst({
      where: { OR: [{ userAId: partner.id }, { userBId: partner.id }] }
    });
    if (partnerRoom) {
      return res.status(400).json({ error: '对方已与其他人配对' });
    }

    // 建立双向 partnerId 绑定，并创建/复用 Room
    let room = await prisma.room.findFirst({
      where: {
        OR: [
          { userAId: req.user.id, userBId: partner.id },
          { userAId: partner.id, userBId: req.user.id }
        ]
      }
    });

    if (!room) {
      room = await prisma.room.create({
        data: {
          userAId: req.user.id,
          userBId: partner.id,
          meName: req.user.nickname || '',
          taName: partner.nickname || '',
          sinceDate: req.user.anniversary ? req.user.anniversary.toISOString().slice(0, 10) : '',
          nextMeetDate: ''
        }
      });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { partnerId: partner.id } }),
      prisma.user.update({ where: { id: partner.id }, data: { partnerId: req.user.id } })
    ]);

    return res.json({ room: roomPublic(room), partner: userPublic(partner) });
  } catch (err) {
    console.error('Pair join error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/pair/unpair
router.post('/unpair', auth, async (req, res) => {
  try {
    const room = await prisma.room.findFirst({
      where: { OR: [{ userAId: req.user.id }, { userBId: req.user.id }] }
    });
    if (!room) {
      return res.status(400).json({ error: '你还没有配对' });
    }

    const partnerId = room.userAId === req.user.id ? room.userBId : room.userAId;

    // 删除共享 Room 及其业务数据
    await prisma.$transaction([
      prisma.wish.deleteMany({ where: { roomId: room.id } }),
      prisma.anniversary.deleteMany({ where: { roomId: room.id } }),
      prisma.mood.deleteMany({ where: { roomId: room.id } }),
      prisma.location.deleteMany({ where: { roomId: room.id } }),
      prisma.moment.deleteMany({ where: { roomId: room.id } }),
      prisma.room.delete({ where: { id: room.id } })
    ]);

    // 清除双方 partnerId
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { partnerId: null } }),
      ...(partnerId ? [prisma.user.update({ where: { id: partnerId }, data: { partnerId: null } })] : [])
    ]);

    return res.json({ ok: true });
  } catch (err) {
    console.error('Pair unpair error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
