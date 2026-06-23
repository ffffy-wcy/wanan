require('dotenv').config();
const { Router } = require('express');
const axios = require('axios');
const prisma = require('../db.js');
const auth = require('../middleware/auth.js');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt.js');

const router = Router();

function randomNickname() {
  return '用户' + String(Math.floor(Math.random() * 9000) + 1000);
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

// ==================== QQ 登录 ====================

// GET /api/auth/qq/url
router.get('/qq/url', (req, res) => {
  try {
    const appId = process.env.QQ_APP_ID;
    const redirectUri = process.env.QQ_REDIRECT_URI;
    const url = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=qq`;
    return res.json({ url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /api/auth/qq/callback
router.get('/qq/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: '缺少授权码' });

    const appId = process.env.QQ_APP_ID;
    const appKey = process.env.QQ_APP_KEY;
    const redirectUri = process.env.QQ_REDIRECT_URI;

    const tokenRes = await axios.get('https://graph.qq.com/oauth2.0/token', {
      params: { grant_type: 'authorization_code', client_id: appId, client_secret: appKey, code, redirect_uri: redirectUri }
    });

    const tokenParams = new URLSearchParams(tokenRes.data);
    const accessToken = tokenParams.get('access_token');
    if (!accessToken) return res.status(400).json({ error: '获取 access_token 失败' });

    const meRes = await axios.get('https://graph.qq.com/oauth2.0/me', {
      params: { access_token: accessToken, fmt: 'json' }
    });

    let openId;
    if (typeof meRes.data === 'string') {
      const match = meRes.data.match(/callback\(\s*(\{.*\})\s*\)/);
      if (match) openId = JSON.parse(match[1]).openid;
    } else if (meRes.data && meRes.data.openid) {
      openId = meRes.data.openid;
    }
    if (!openId) return res.status(400).json({ error: '获取 openid 失败' });

    // 查找或创建用户
    let user = await prisma.user.findUnique({ where: { openId } });
    if (!user) {
      user = await prisma.user.create({
        data: { platform: 'qq', openId, nickname: randomNickname() }
      });
    }

    const tokens = makeTokens(user);
    const userParam = encodeURIComponent(JSON.stringify(tokens.user));
    const baseUrl = (process.env.QQ_REDIRECT_URI || '').split('/api/auth/qq/callback')[0] || 'http://localhost:3000';
    return res.redirect(`${baseUrl}/?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&user=${userParam}`);
  } catch (err) {
    console.error('QQ callback error:', err.message);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

// ==================== 通用 ====================

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: '缺少 refreshToken' });

    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: '用户不存在' });

    const jwtPayload = { userId: user.id, platform: user.platform, openId: user.openId, phone: user.phone, email: user.email };
    return res.json({
      accessToken: signAccessToken(jwtPayload),
      refreshToken: signRefreshToken(jwtPayload)
    });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'refreshToken 无效或已过期' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const room = await prisma.room.findFirst({
      where: { OR: [{ userAId: req.user.id }, { userBId: req.user.id }] }
    });

    const partner = req.user.partnerId
      ? await prisma.user.findUnique({ where: { id: req.user.partnerId } })
      : null;

    return res.json({
      user: {
        id: req.user.id,
        platform: req.user.platform,
        nickname: req.user.nickname,
        avatarUrl: req.user.avatarUrl,
        phone: req.user.phone,
        email: req.user.email,
        gender: req.user.gender,
        anniversary: req.user.anniversary,
        matchCode: req.user.matchCode,
        createdAt: req.user.createdAt,
        hasProfile: hasProfile(req.user),
        room: room ? { id: room.id, userAId: room.userAId, userBId: room.userBId, createdAt: room.createdAt } : null,
        partner: partner ? userPublic(partner) : null
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
module.exports.makeTokens = makeTokens;
module.exports.userPublic = userPublic;
module.exports.hasProfile = hasProfile;
module.exports.maskPhone = maskPhone;
