const jwt = require('jsonwebtoken');
const { prisma } = require('../models/db');
const { isRecentlyOnline } = require('../services/presence.service');
const { sendApiError } = require('./api-response');

// Only set Secure cookie flag when HTTPS is available
const useSecureCookies = process.env.NODE_ENV === 'production' && process.env.SKIP_HTTPS_REDIRECT !== 'true';

function signToken(user) {
  const payload = { sub: user.id, role: user.role };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });
}

function setSessionLocationCookie(res, location) {
  res.cookie('sessionLocation', String(location || '').trim(), {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });
}

function clearSessionLocationCookie(res) {
  res.clearCookie('sessionLocation', {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax'
  });
}

async function attachUser(req, res, next) {
  try {
    const token = req.cookies.token;
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { patientProfile: true, doctorProfile: true }
    });

    if (!user || !user.isActive) {
      req.user = null;
      res.clearCookie('token');
      return next();
    }

    user.isPresenceOnline = isRecentlyOnline(user.lastSeenAt);
    user.isCallOnline =
      user.role === 'doctor'
        ? Boolean(user.doctorProfile?.callEnabled) && user.isPresenceOnline
        : user.isPresenceOnline;

    req.user = user;
    return next();
  } catch (e) {
    req.user = null;
    res.clearCookie('token');
    return next();
  }
}

function authRequired(req, res, next) {
  if (req.user) return next();
  if (req.isApi) return sendApiError(req, res, 401, 'Unauthorized', 'UNAUTHORIZED');
  if (req.accepts('html')) return res.redirect('/auth/login');
  return sendApiError(req, res, 401, 'Unauthorized', 'UNAUTHORIZED');
}

function roleRequired(...roles) {
  return (req, res, next) => {
    if (!req.user) return authRequired(req, res, next);
    if (!roles.includes(req.user.role)) return sendApiError(req, res, 403, 'Forbidden', 'FORBIDDEN');
    return next();
  };
}

module.exports = {
  attachUser,
  authRequired,
  roleRequired,
  signToken,
  setAuthCookie,
  setSessionLocationCookie,
  clearSessionLocationCookie
};
