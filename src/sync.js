const { Server } = require('socket.io');
const jwt = require('./utils/jwt');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('未登录'));
      const payload = jwt.verifyAccessToken(token);
      socket.userId = payload.userId;
      socket.userPlatform = payload.platform;
      next();
    } catch (e) {
      next(new Error('认证失败'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WS] 用户连接: ${socket.userId}`);

    // Join room: client emits 'join' with { roomId }
    socket.on('join', (data) => {
      const roomId = data.roomId;
      if (roomId) {
        socket.join(`room:${roomId}`);
        console.log(`[WS] 用户 ${socket.userId} 加入房间 ${roomId}`);
      }
    });

    // Leave room
    socket.on('leave', (data) => {
      const roomId = data.roomId;
      if (roomId) {
        socket.leave(`room:${roomId}`);
      }
    });

    // Heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { t: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WS] 用户断开: ${socket.userId}, 原因: ${reason}`);
    });
  });

  return io;
}

module.exports = { initSocket };