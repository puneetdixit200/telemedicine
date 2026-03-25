const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { prisma } = require('../models/db');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.APP_BASE_URL || '*',
      methods: ['GET', 'POST']
    }
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
        select: { id: true, doctorId: true, patientId: true, startAt: true }
      });
      if (!appt) return;
      if (socket.user.id !== appt.doctorId && socket.user.id !== appt.patientId) return;

      const room = `appt:${appointmentId}`;
      socket.join(room);
      socket.to(room).emit('peer_joined', { userId: socket.user.id });
    });

    socket.on('signal', ({ appointmentId, type, payload }) => {
      if (!appointmentId || !type) return;
      const room = `appt:${appointmentId}`;
      socket.to(room).emit('signal', {
        fromUserId: socket.user.id,
        type,
        payload
      });
    });

    socket.on('chat', ({ appointmentId, message }) => {
      if (!appointmentId || !message) return;
      const room = `appt:${appointmentId}`;
      io.to(room).emit('chat', {
        fromUserId: socket.user.id,
        fromName: socket.user.fullName,
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
