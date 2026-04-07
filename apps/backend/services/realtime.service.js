const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { prisma } = require('../models/db');

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/$/, '');
}

function getAllowedOrigins() {
  return String(process.env.APP_BASE_URL || '')
    .split(',')
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);
}

function initSocket(httpServer) {
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = getAllowedOrigins();
  const allowNoOriginSocket = process.env.ALLOW_NO_ORIGIN_SOCKET === 'true';

  if (isProd && !allowedOrigins.length) {
    throw new Error('APP_BASE_URL must be set in production to a trusted HTTPS origin for Socket.IO CORS.');
  }

  const corsOrigin = isProd
    ? (origin, callback) => {
        const normalized = normalizeOrigin(origin);

        if (!normalized) {
          if (allowNoOriginSocket) {
            return callback(null, true);
          }
          return callback(new Error('Socket.IO origin header missing.'));
        }

        if (allowedOrigins.includes(normalized)) {
          return callback(null, true);
        }

        return callback(new Error('Socket.IO CORS origin not allowed.'));
      }
    : '*';

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Azure requires websocket transport + long-polling fallback
    transports: ['websocket', 'polling']
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user || !user.isActive) return next(new Error('unauthorized'));
      socket.user = { id: user.id, role: user.role, fullName: user.fullName };
      return next();
    } catch (e) {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_room', async ({ appointmentId }) => {
      if (!appointmentId) return;
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true, doctorId: true, patientId: true, startAt: true, status: true }
      });
      if (!appt) return;
      if (socket.user.id !== appt.doctorId && socket.user.id !== appt.patientId) return;
      if (appt.status !== 'booked') return;

      const room = `appt:${appointmentId}`;
      socket.join(room);
      socket.to(room).emit('peer_joined', { userId: socket.user.id });
    });

    socket.on('signal', async ({ appointmentId, type, payload }) => {
      if (!appointmentId || !type) return;
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { status: true, doctorId: true, patientId: true }
      });
      if (!appt) return;
      if (socket.user.id !== appt.doctorId && socket.user.id !== appt.patientId) return;
      if (appt.status !== 'booked') return;

      const room = `appt:${appointmentId}`;
      socket.to(room).emit('signal', {
        fromUserId: socket.user.id,
        type,
        payload
      });
    });

    socket.on('chat', async ({ appointmentId, message }) => {
      if (!appointmentId || !message) return;
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { status: true, doctorId: true, patientId: true }
      });
      if (!appt) return;
      if (socket.user.id !== appt.doctorId && socket.user.id !== appt.patientId) return;
      if (appt.status !== 'booked') return;

      const room = `appt:${appointmentId}`;
      io.to(room).emit('chat', {
        fromUserId: socket.user.id,
        fromRole: socket.user.role,
        message,
        at: new Date().toISOString()
      });
    });

    socket.on('leave_room', ({ appointmentId }) => {
      const room = `appt:${appointmentId}`;
      socket.leave(room);
      socket.to(room).emit('peer_left', { userId: socket.user.id });
    });

    socket.on('disconnect', () => {
      // rooms auto-handled
    });
  });

  return io;
}

module.exports = { initSocket };
