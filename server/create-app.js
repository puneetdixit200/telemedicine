const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { attachUser } = require('../middleware/auth');
const { enableApiMode } = require('../middleware/api-mode');
const { requestContext, requestLogger } = require('../middleware/request-context');
const { errorHandler, notFoundHandler } = require('../middleware/errors');
const { registerApiRoutes, documentsRoutes } = require('../routes');

morgan.token('request-id', (req) => req.requestId || '-');

function mountApiRoutes(app) {
  const apiRouter = express.Router();
  apiRouter.use(enableApiMode);
  registerApiRoutes(apiRouter);

  app.use('/api', apiRouter);
  app.use('/api/v1', apiRouter);

  // Keep non-API local download route support in case local-mode URLs are generated.
  app.use('/documents', documentsRoutes);
}

function createApp() {
  const app = express();
  const projectRoot = path.join(__dirname, '..');

  const frontendDistPath = path.join(projectRoot, 'frontend', 'dist');
  const frontendSourceIndexPath = path.join(projectRoot, 'frontend', 'index.html');

  app.use(requestContext);
  app.use(requestLogger);

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
            'https://cdn.gtranslate.net',
            'https://www.gstatic.com',
            "'sha256-GMDREuNQNJynOQvCXFCl/JLp3JtjQWFHx+V4UdEFI34='"
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: [
            "'self'",
            'https://translate.googleapis.com',
            'https://translate-pa.googleapis.com',
            'https://translate.google.com',
            'https://cdn.gtranslate.net'
          ],
          frameSrc: ["'self'", 'https://translate.google.com', 'https://*.google.com', 'https://*.gtranslate.net'],
          fontSrc: ["'self'", 'https:', 'data:']
        }
      }
    })
  );
  app.use(morgan(':method :url :status :response-time ms req_id=:request-id'));
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

  app.use('/public', express.static(path.join(projectRoot, 'public')));

  // Attach logged-in user (if any) from JWT cookie.
  app.use(attachUser);

  mountApiRoutes(app);

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

module.exports = { createApp };
