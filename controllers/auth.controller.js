const bcrypt = require('bcryptjs');
const { prisma } = require('../models/db');
const { loginSchema, registerSchema } = require('../models/schemas/auth.schemas');
const { signToken, setAuthCookie } = require('../middleware/auth');

function normalizePhone(value) {
  return String(value || '')
    .replace(/[^0-9]/g, '')
    .trim();
}

const authController = {
  viewLogin: (req, res) => res.render('login', { user: req.user || null, error: null }),
  viewRegister: (req, res) => res.render('register', { user: req.user || null, error: null }),

  login: async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).render('login', { user: null, error: 'Invalid email/password.' });

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) return res.status(401).render('login', { user: null, error: 'Invalid email/password.' });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).render('login', { user: null, error: 'Invalid email/password.' });

      const token = signToken(user);
      setAuthCookie(res, token);
      return res.redirect('/dashboard');
    } catch (e) {
      return next(e);
    }
  },

  register: async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).render('register', { user: null, error: 'Invalid form inputs.' });

      const data = parsed.data;

      if (data.role === 'admin') {
        const invite = process.env.ADMIN_INVITE_CODE;
        if (invite && data.adminInviteCode !== invite) {
          return res.status(403).render('register', { user: null, error: 'Admin invite code is invalid.' });
        }
      }

      if (data.role === 'doctor' && !data.specialization) {
        return res.status(400).render('register', { user: null, error: 'Doctor specialization is required.' });
      }

      if (data.role === 'help_worker') {
        const normalizedPhone = normalizePhone(data.phone);
        if (!normalizedPhone) {
          return res.status(400).render('register', { user: null, error: 'Help worker phone number is required.' });
        }
        if (!String(data.address || '').trim()) {
          return res.status(400).render('register', { user: null, error: 'Service area or address is required for help worker accounts.' });
        }
        if (!String(data.language || '').trim()) {
          return res.status(400).render('register', { user: null, error: 'Preferred language is required for help worker accounts.' });
        }
      }

      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) return res.status(409).render('register', { user: null, error: 'Email already registered.' });

      const passwordHash = await bcrypt.hash(data.password, 12);

      const created = await prisma.user.create({
        data: {
          email: data.email,
          phone: normalizePhone(data.phone) || null,
          fullName: data.fullName,
          passwordHash,
          role: data.role,
          gender: data.gender || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          address: data.address || null,
          language: data.language || null,
          timeZone: data.timeZone || null,
          doctorProfile:
            data.role === 'doctor'
              ? {
                  create: {
                    specialization: data.specialization,
                    yearsOfExperience: data.yearsOfExperience ? Number(data.yearsOfExperience) : null,
                    qualifications: data.qualifications || null,
                    clinicName: data.clinicName || null,
                    consultationLanguages: data.consultationLanguages || null,
                    description: data.description || null
                  }
                }
              : undefined,
          patientProfile: data.role === 'patient' ? { create: {} } : undefined
        }
      });

      const token = signToken(created);
      setAuthCookie(res, token);
      return res.redirect('/dashboard');
    } catch (e) {
      return next(e);
    }
  },

  logout: (req, res) => {
    res.clearCookie('token');
    return res.redirect('/auth/login');
  }
};

module.exports = { authController };
