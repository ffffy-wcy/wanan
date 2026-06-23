require('dotenv').config();
const { Router } = require('express');
const prisma = require('../db.js');
const { signAccessToken, signRefreshToken } = require('../utils/jwt.js');

const router = Router();

// 内存验证码存储：phone -> { code, expiresAt, lastSentAt }
const smsCodeStore = new Map();
const CODE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 秒

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function generateCode() {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

function maskPhone(phone) {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function hasProfile(user) {
  return !!(user.nickname && user.gender && user.anniversary);
}

function userPublic(user) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    hasProfile: hasProfile(user)
  };
}

function makeTokens(user) {
  const jwtPayload = { userId: user.id, platform: user.platform, phone: user.phone };
  return {
    accessToken: signAccessToken(jwtPayload),
    refreshToken: signRefreshToken(jwtPayload),
    user: userPublic(user)
  };
}

// POST /api/auth/sms/send
router.post('/send', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    const now = Date.now();
    const record = smsCodeStore.get(phone);
    if (record && now - record.lastSentAt < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ error: '发送过于频繁，请稍后再试' });
    }

    const code = generateCode();
    smsCodeStore.set(phone, {
      code,
      expiresAt: now + CODE_TTL_MS,
      lastSentAt: now
    });

    // 开发期直接输出到控制台；生产环境应接入短信网关
    console.log(`[SMS] 手机号 ${phone} 的验证码是: ${code}`);

    return res.json({ ok: true, message: '验证码已发送' });
  } catch (err) {
    console.error('SMS send error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/auth/sms/login
router.post('/login', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '验证码格式不正确' });
    }

    const record = smsCodeStore.get(phone);
    if (!record) {
      return res.status(400).json({ error: '验证码错误，请重新输入' });
    }
    if (Date.now() > record.expiresAt) {
      smsCodeStore.delete(phone);
      return res.status(400).json({ error: '验证码已过期，请重新获取' });
    }
    if (record.code !== code) {
      return res.status(400).json({ error: '验证码错误，请重新输入' });
    }

    // 验证通过，删除已使用验证码
    smsCodeStore.delete(phone);

    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          platform: 'sms',
          phone,
          nickname: maskPhone(phone)
        }
      });
    }

    const tokens = makeTokens(user);
    return res.json(tokens);
  } catch (err) {
    console.error('SMS login error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
module.exports.smsCodeStore = smsCodeStore;
