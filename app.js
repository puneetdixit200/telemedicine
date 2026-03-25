require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { attachUser } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/errors');
const { initSocket } = require('./realtime/socket');

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

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(helmet());
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

  app.get('/', (req, res) => res.redirect('/dashboard'));
  app.get('/dashboard', (req, res) => {
    return res.render('dashboard', { user: req.user || null, message: null });
  });

  app.use('/auth', authRoutes);
  app.use('/users', usersRoutes);
  app.use('/doctors', doctorsRoutes);
  app.use('/patients', patientsRoutes);
  app.use('/appointments', appointmentsRoutes);
  app.use('/calls', callsRoutes);
  app.use('/prescriptions', prescriptionsRoutes);
  app.use('/documents', documentsRoutes);

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
