/* =========================================================
   goodnight socket.js
   Socket.IO 客户端模块，封装连接、房间管理和事件监听
   ========================================================= */
const Socket = {
  io: null,
  listeners: {},

  connect(token) {
    if (this.io && this.io.connected) return;
    this.io = io(window.location.origin, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    this.io.on('connect', () => {
      console.log('[WS] 已连接');
    });

    this.io.on('disconnect', (reason) => {
      console.error('[WS] 断开:', reason);
    });

    this.io.on('connect_error', (err) => {
      console.error('[WS] 连接错误:', err.message);
    });
  },

  joinRoom(roomId) {
    if (this.io) this.io.emit('join', { roomId });
  },

  leaveRoom(roomId) {
    if (this.io) this.io.emit('leave', { roomId });
  },

  disconnect() {
    if (this.io) { this.io.disconnect(); this.io = null; }
  },

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    if (this.io) this.io.on(event, callback);
  },

  off(event, callback) {
    if (this.io && callback) this.io.off(event, callback);
  },
};
