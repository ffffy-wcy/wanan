require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const jwt = require('./jwt');

const testUser = { userId: 'test-123', platform: 'qq', openId: 'test-openid' };

// Test sign + verify
const accessToken = jwt.signAccessToken(testUser);
console.log('Access Token:', accessToken.substring(0, 30) + '...');

const payload = jwt.verifyAccessToken(accessToken);
console.log('Verified payload:', payload);
console.log('Test passed:', payload.userId === 'test-123');

// Test invalid token
try {
  jwt.verifyAccessToken('invalid-token');
  console.log('Should have thrown!');
} catch (e) {
  console.log('Invalid token correctly rejected:', e.message);
}

const refreshToken = jwt.signRefreshToken(testUser);
console.log('Refresh Token:', refreshToken.substring(0, 30) + '...');
const refreshPayload = jwt.verifyRefreshToken(refreshToken);
console.log('Refresh verified:', refreshPayload.userId === 'test-123');