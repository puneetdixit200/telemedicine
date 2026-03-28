require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { prisma } = require('./models/db');

const { attachUser } = require('./middleware/auth');
const { enableApiMode } = require('./middleware/api-mode');
const { errorHandler, notFoundHandler } = require('./middleware/errors');
const { initSocket } = require('./services/realtime.service');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const doctorsRoutes = require('./routes/doctors.routes');
const patientsRoutes = require('./routes/patients.routes');
const appointmentsRoutes = require('./routes/appointments.routes');
const callsRoutes = require('./routes/calls.routes');
const prescriptionsRoutes = require('./routes/prescriptions.routes');
const documentsRoutes = require('./routes/documents.routes');

function createApp() {
  const app = express();

  const frontendDistPath = path.join(__dirname, 'frontend', 'dist');
  const frontendSourceIndexPath = path.join(__dirname, 'frontend', 'index.html');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            'https://translate.google.com',
            'https://translate.googleapis.com',
            'https://translate-pa.googleapis.com',
            'https://www.gstatic.com',
            "'sha256-GMDREuNQNJynOQvCXFCl/JLp3JtjQWFHx+V4UdEFI34='"
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https://translate.googleapis.com', 'https://translate-pa.googleapis.com', 'https://translate.google.com'],
          frameSrc: ["'self'", 'https://translate.google.com', 'https://*.google.com'],
          fontSrc: ["'self'", 'https:', 'data:']
        }
      }
    })
  );
  app.use(morgan('dev'));
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/public', express.static(path.join(__dirname, 'public')));

  // Attach logged-in user (if any) from JWT cookie.
  app.use(attachUser);

  const apiRouter = express.Router();
  apiRouter.use(enableApiMode);

  apiRouter.get('/session', (req, res) => res.json({ ok: true, user: req.user || null }));

  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/users', usersRoutes);
  apiRouter.use('/doctors', doctorsRoutes);
  apiRouter.use('/patients', patientsRoutes);
  apiRouter.use('/appointments', appointmentsRoutes);
  apiRouter.use('/calls', callsRoutes);
  apiRouter.use('/prescriptions', prescriptionsRoutes);
  apiRouter.use('/documents', documentsRoutes);

  app.use('/api', apiRouter);

  // Keep non-API local download route support in case local-mode URLs are generated.
  app.use('/documents', documentsRoutes);

  app.use(
    express.static(frontendDistPath, {
      setHeaders: (res, staticPath) => {
        // Prevent stale hashed-asset references after rebuilds.
        if (staticPath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store');
          return;
        }

        if (staticPath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    })
  );

  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/socket.io') ||
      req.path.startsWith('/documents/') ||
      req.path.startsWith('/assets/')
    ) {
      return next();
    }

    const distIndexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(distIndexPath)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.sendFile(distIndexPath);
    }

    // Test suite expects a simple SPA shell even without a production build.
    if (process.env.NODE_ENV === 'test' && fs.existsSync(frontendSourceIndexPath)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.sendFile(frontendSourceIndexPath);
    }

    return res.status(503).json({
      error: 'Frontend build not found. Run "npm run frontend:build" for port 3000, or use "npm run frontend:dev" on port 5173.'
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function createServer() {
  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);
  return { app, server, io };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const { server } = createServer();
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });
}

module.exports = { createApp, createServer };
