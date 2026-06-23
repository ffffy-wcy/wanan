require('dotenv').config();
const { Router } = require('express');
const { Resend } = require('resend');
const prisma = require('../db.js');
const { signAccessToken, signRefreshToken } = require('../utils/jwt.js');

const router = Router();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';

async function sendVerificationEmail(to, code) {
  if (!resend) return false;
  const { data, error } = await resend.emails.send({
    from: `晚安 <${RESEND_FROM}>`,
    to,
    subject: '【晚安】您的验证码',
    text: `您的验证码是：${code}，5 分钟内有效。`,
    html: `<p>您的验证码是：<strong>${code}</strong></p><p>5 分钟内有效，请勿泄露给他人。</p>`
  });
  if (error) {
    console.error('Resend send error:', error);
    throw new Error('邮件发送失败');
  }
  return !!data;
}

// 内存验证码存储：email -> { code, expiresAt, lastSentAt }
const emailCodeStore = new Map();
const CODE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 秒

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateCode() {
  return String(Math.floor(Math.random() * 900000) + 100000);
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
    email: user.email,
    hasProfile: hasProfile(user)
  };
}

function makeTokens(user) {
  const jwtPayload = { userId: user.id, platform: user.platform, email: user.email };
  return {
    accessToken: signAccessToken(jwtPayload),
    refreshToken: signRefreshToken(jwtPayload),
    user: userPublic(user)
  };
}

// POST /api/auth/email/send
router.post('/send', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    const now = Date.now();
    const record = emailCodeStore.get(email);
    if (record && now - record.lastSentAt < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ error: '发送过于频繁，请稍后再试' });
    }

    const code = generateCode();

    try {
      const sent = await sendVerificationEmail(email, code);
      if (!sent) {
        // 未配置 RESEND_API_KEY 时回退到控制台输出
        console.log(`[EMAIL] 邮箱 ${email} 的验证码是: ${code}`);
      }
    } catch (err) {
      console.error('Resend send failed:', err);
      return res.status(500).json({ error: '邮件发送失败，请检查 Resend 配置' });
    }

    // 邮件发送成功后再保存验证码，避免用户收到废码
    emailCodeStore.set(email, {
      code,
      expiresAt: now + CODE_TTL_MS,
      lastSentAt: now
    });

    return res.json({ ok: true, message: '验证码已发送' });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/auth/email/login
router.post('/login', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '验证码格式不正确' });
    }

    const record = emailCodeStore.get(email);
    if (!record) {
      return res.status(400).json({ error: '验证码错误，请重新输入' });
    }
    if (Date.now() > record.expiresAt) {
      emailCodeStore.delete(email);
      return res.status(400).json({ error: '验证码已过期，请重新获取' });
    }
    if (record.code !== code) {
      return res.status(400).json({ error: '验证码错误，请重新输入' });
    }

    emailCodeStore.delete(email);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          platform: 'email',
          email,
          nickname: email.split('@')[0]
        }
      });
    }

    const tokens = makeTokens(user);
    return res.json(tokens);
  } catch (err) {
    console.error('Email login error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
module.exports.emailCodeStore = emailCodeStore;
