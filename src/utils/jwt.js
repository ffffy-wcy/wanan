require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

function signAccessToken(user) {
  return jwt.sign(
    { userId: user.userId, platform: user.platform, openId: user.openId, phone: user.phone, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { userId: user.userId },
    JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };