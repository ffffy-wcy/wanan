require('dotenv').config();
const { Router } = require('express');
const prisma = require('../db.js');
const auth = require('../middleware/auth.js');

const router = Router();

function hasProfile(user) {
  return !!(user.nickname && user.gender && user.anniversary);
}

// PATCH /api/profile
router.patch('/', auth, async (req, res) => {
  try {
    const { nickname, gender, anniversary } = req.body;
    const updateData = {};

    if (nickname !== undefined) {
      const trimmed = String(nickname).trim();
      if (trimmed.length < 2 || trimmed.length > 20) {
        return res.status(400).json({ error: '昵称长度需在 2-20 个字符之间' });
      }
      updateData.nickname = trimmed;
    }

    if (gender !== undefined) {
      const g = String(gender).toLowerCase();
      if (!['boy', 'girl', 'male', 'female', '男', '女'].includes(g)) {
        return res.status(400).json({ error: '性别无效' });
      }
      // 统一存储为 boy / girl
      updateData.gender = ['male', 'boy', '男'].includes(g) ? 'boy' : 'girl';
    }

    if (anniversary !== undefined) {
      const date = new Date(anniversary);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: '纪念日日期无效' });
      }
      updateData.anniversary = date;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    return res.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        email: user.email,
        gender: user.gender,
        anniversary: user.anniversary,
        matchCode: user.matchCode,
        hasProfile: hasProfile(user)
      }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: '更新失败' });
  }
});

module.exports = router;
