const { verifyAccessToken } = require('../utils/jwt');
const prisma = require('../db');

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未登录，请先登录' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(401).json({ error: '未登录，请先登录' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
}

module.exports = auth;