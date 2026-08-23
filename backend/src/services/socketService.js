// src/services/socketService.js  — CORRECTED
'use strict';
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const { ALLOWED_ORIGINS } = require('../config/corsOrigins');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin:      ALLOWED_ORIGINS,
      credentials: true,
    },
  });

  // JWT auth middleware for socket connections
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.cookie
          ?.split(';')
          .find((c) => c.trim().startsWith('accessToken='))
          ?.split('=')[1];

      if (!token) return next(new Error('Unauthorized'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.role   = decoded.role;
      socket.name   = decoded.name || '';
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌  Socket connected: ${socket.userId} (${socket.role})`);

    socket.join(socket.role);
    socket.join(`user:${socket.userId}`);

    socket.on('join:session',  (sessionId) => socket.join(`session:${sessionId}`));
    socket.on('leave:session', (sessionId) => socket.leave(`session:${sessionId}`));

    // ── Optional chat relay ───────────────────────────────────────────
    // In-room chat is normally carried by LiveKit's data channel (useChat),
    // which already fans a trainer's message out to every trainee in the
    // room. This socket relay is a FALLBACK so a message typed by the
    // trainer reaches every trainee joined to `session:<id>` even outside
    // the LiveKit room (e.g. a sidebar chat before the stream starts).
    socket.on('session:chat', ({ sessionId, text }) => {
      if (!sessionId || !text?.trim()) return;
      io.to(`session:${sessionId}`).emit('session:chat', {
        sessionId,
        text:   String(text).slice(0, 2000),
        from:   { id: socket.userId, name: socket.name, role: socket.role },
        sentAt: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () =>
      console.log(`🔌  Socket disconnected: ${socket.userId}`)
    );
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized — call initSocket first');
  return io;
};

// ── Emit helpers ──────────────────────────────────────────────────────
const emitToSession = (sessionId, event, data) => getIO().to(`session:${sessionId}`).emit(event, data);
const emitToRole    = (role, event, data)       => getIO().to(role).emit(event, data);
const emitToUser    = (userId, event, data)     => getIO().to(`user:${userId}`).emit(event, data);

module.exports = { initSocket, getIO, emitToSession, emitToRole, emitToUser };
