const jwt = require('jsonwebtoken');
const { prisma } = require('../models/db');

function signToken(user) {
  const payload = { sub: user.id, role: user.role };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });
}

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
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
  if (req.accepts('html')) return res.redirect('/auth/login');
  return res.status(401).json({ error: 'Unauthorized' });
}

function roleRequired(...roles) {
  return (req, res, next) => {
    if (!req.user) return authRequired(req, res, next);
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };
}

module.exports = { attachUser, authRequired, roleRequired, signToken, setAuthCookie };
