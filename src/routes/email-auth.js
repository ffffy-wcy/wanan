require('dotenv').config();
const { Router } = require('express');
const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError
} = require('@prisma/client');
const prisma = require('../db.js');
const { signAccessToken, signRefreshToken } = require('../utils/jwt.js');

const router = Router();

const APP_NAME = process.env.APP_NAME || 'goodnight';

const outlookTransporter = process.env.EMAIL_USER && process.env.EMAIL_PASS
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.office365.com',
      port: Number(process.env.EMAIL_PORT || 587),
      secure: String(process.env.EMAIL_PORT || 587) === '465',
      requireTLS: String(process.env.EMAIL_PORT || 587) !== '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })
  : null;
const OUTLOOK_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';

const smtpTransporter = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_PORT || 465) === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function sendVerificationEmail(to, code) {
  const message = {
    to,
    subject: `【${APP_NAME}】您的验证码`,
    text: `您的 ${APP_NAME} 验证码是：${code}，5 分钟内有效。`,
    html: `<p>您的 ${APP_NAME} 验证码是：<strong>${code}</strong></p><p>5 分钟内有效，请勿泄露给他人。</p>`
  };

  if (outlookTransporter) {
    try {
      await outlookTransporter.sendMail({
        from: `${APP_NAME} <${OUTLOOK_FROM}>`,
        ...message
      });
      return true;
    } catch (err) {
      console.error('Outlook SMTP send error:', err);
      if (!smtpTransporter && !resend) {
        throw new Error('邮件发送失败，请检查 Outlook 发件箱配置');
      }
      console.warn('Outlook SMTP failed, falling back to legacy email providers.');
    }
  }

  if (smtpTransporter) {
    try {
      await smtpTransporter.sendMail({
        from: `${APP_NAME} <${SMTP_FROM}>`,
        ...message
      });
      return true;
    } catch (err) {
      console.error('SMTP send error:', err);
      if (!resend) {
        throw new Error('邮件发送失败，请检查 SMTP 配置');
      }
      console.warn('SMTP failed, falling back to Resend.');
    }
  }

  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: `${APP_NAME} <${RESEND_FROM}>`,
        ...message
      });
      if (error) {
        throw error;
      }
      return !!data;
    } catch (err) {
      console.error('Resend send error:', err);
      if (!outlookTransporter && !smtpTransporter) {
        throw new Error('邮件发送失败，请检查 Resend 发件域名或收件邮箱限制');
      }
      throw new Error('邮件发送失败，请稍后再试');
    }
  }

  return false;
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

function makeTokens(user) {
  const jwtPayload = { userId: user.id, platform: user.platform, openId: user.openId, phone: user.phone, email: user.email };
  return {
    accessToken: signAccessToken(jwtPayload),
    refreshToken: signRefreshToken(jwtPayload),
    user: userPublic(user)
  };
}

// POST /api/auth/email/send
router.post('/send', async (req, res) => {
  try {
    const email = normalizeEmail(req.body && req.body.email);
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
      console.error('Email send failed:', err);
      return res.status(500).json({ error: err.message || '邮件暂时发不出去，请稍后再试' });
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
    const email = normalizeEmail(req.body && req.body.email);
    const code = String((req.body && req.body.code) || '').trim();
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

    try {
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

      try {
        const tokens = makeTokens(user);
        emailCodeStore.delete(email);
        return res.json(tokens);
      } catch (jwtErr) {
        console.error('Email login JWT error:', jwtErr);
        return res.status(500).json({ error: '登录服务配置异常' });
      }
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError ||
        err instanceof PrismaClientUnknownRequestError ||
        err instanceof PrismaClientRustPanicError ||
        err instanceof PrismaClientInitializationError ||
        err instanceof PrismaClientValidationError
      ) {
        console.error('Email login database error:', err);
        return res.status(500).json({ error: '登录服务暂不可用' });
      }
      throw err;
    }
  } catch (err) {
    console.error('Email login unexpected error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
module.exports.emailCodeStore = emailCodeStore;
