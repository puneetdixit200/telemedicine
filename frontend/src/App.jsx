import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
} from 'react-router-dom';
import { apiRequest, utcDateTime } from './lib/api';
import TranslationService from './TranslationService';

const SessionContext = createContext(null);
const AI_OFFLINE_DRAFTS_KEY = 'ai:offline-drafts:v1';

function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('SessionContext not available');
  }
  return value;
}

function formatDoctorRating(average, count) {
  if (!count) return 'No patient ratings yet';
  return `${Number(average || 0).toFixed(1)} / 5 from ${count} review${count > 1 ? 's' : ''}`;
}

function formatPrettyDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatPrettyTime(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/session');
      if (!res.ok) {
        setUser(null);
        return;
      }
      setUser(res.data?.user || null);
    } catch (_err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const contextValue = useMemo(
    () => ({ user, setUser, loading, refreshSession }),
    [user, loading, refreshSession]
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <h1>Telemedicine Hub</h1>
        <p>Loading your care dashboard...</p>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={contextValue}>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/help-center" element={<HelpCenterPage />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/book" element={user?.role === 'patient' ? <BookingWizardPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/medicines" element={user?.role === 'patient' ? <MedicineCabinetPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/users/me" element={<ProfilePage />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/doctors/:doctorId" element={<DoctorDetailPage />} />
          <Route path="/doctors/me/slots" element={user?.role === 'doctor' ? <DoctorSlotsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/doctors/me/analytics" element={user?.role === 'doctor' ? <DoctorAnalyticsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/appointments/impact" element={<ImpactPage />} />
          <Route path="/appointments/:appointmentId" element={<AppointmentDetailPage />} />
          <Route path="/reminders" element={<RemindersPage />} />
          <Route path="/ai-copilot" element={<AICopilotPage />} />
          <Route
            path="/support/consents"
            element={user?.role === 'patient' || user?.role === 'help_worker' ? <CareSupportPage /> : <Navigate to="/dashboard" replace />}
          />
          <Route path="/async-consults" element={<AsyncConsultsPage />} />
          <Route path="/async-consults/:consultId" element={<AsyncConsultDetailPage />} />
          <Route path="/calls/:appointmentId" element={<CallPage />} />
          <Route path="/prescriptions/:appointmentId" element={<PrescriptionPage />} />
          <Route path="/patients/workspace" element={user?.role === 'patient' ? <PatientWorkspacePage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/patients/me" element={<PatientHealthPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <RuralSupportLayer />
    </SessionContext.Provider>
  );
}

function LegalPage({ title, updatedAt, intro, sections }) {
  const { user } = useSession();

  return (
    <section className="stack">
      <article className="card">
        <p className="kicker">Legal & Support</p>
        <h2>{title}</h2>
        <p className="muted">Last updated: {updatedAt}</p>
        <p>{intro}</p>
      </article>

      {sections.map((section) => (
        <article className="card" key={section.heading}>
          <h3>{section.heading}</h3>
          {section.body.map((line, idx) => (
            <p key={`${section.heading}-${idx}`} className="muted">{line}</p>
          ))}
        </article>
      ))}

      <article className="card row-inline">
        <Link className="btn subtle" to={user ? '/dashboard' : '/auth/login'}>
          {user ? 'Back to Dashboard' : 'Back to Login'}
        </Link>
        <Link className="btn subtle" to="/auth/register">
          Create Account
        </Link>
      </article>
    </section>
  );
}

function PrivacyPolicyPage() {
  const sections = [
    {
      heading: 'Information We Collect',
      body: [
        'We collect profile details such as name, email, phone number, and account role to provide telemedicine access.',
        'We also store appointment details, consultation messages, reminders, and documents you upload for clinical workflows.'
      ]
    },
    {
      heading: 'How We Use Information',
      body: [
        'Your information is used to schedule visits, support doctor-patient communication, and maintain care history.',
        'Operational data may be used to improve reliability, network fallback behavior, and user safety alerts.'
      ]
    },
    {
      heading: 'Data Sharing and Access',
      body: [
        'Access is role-based: patients, doctors, admins, and delegated help workers see only permitted records.',
        'Delegated helper access requires active patient consent and can be revoked by the patient at any time.'
      ]
    },
    {
      heading: 'Your Choices',
      body: [
        'You can update your profile details and control communication preferences in your account.',
        'For account deletion or data requests, contact support through the Help Center page.'
      ]
    }
  ];

  return (
    <LegalPage
      title="Privacy Policy"
      updatedAt="March 29, 2026"
      intro="This policy explains how Telemedicine Hub handles personal and care-related information."
      sections={sections}
    />
  );
}

function TermsOfServicePage() {
  const sections = [
    {
      heading: 'Service Scope',
      body: [
        'Telemedicine Hub provides remote consultation tools, appointment coordination, reminders, and records support.',
        'Emergency medical conditions should be directed to local emergency services immediately.'
      ]
    },
    {
      heading: 'Account Responsibilities',
      body: [
        'You are responsible for keeping your login credentials secure and for activity under your account.',
        'You must provide accurate profile and health context information for safe care decisions.'
      ]
    },
    {
      heading: 'Acceptable Use',
      body: [
        'Do not misuse the platform, impersonate other users, or attempt unauthorized data access.',
        'Platform abuse may result in account suspension or termination.'
      ]
    },
    {
      heading: 'Availability and Changes',
      body: [
        'Features may evolve over time to improve care quality and network resilience.',
        'Continued use of the platform after updates implies acceptance of revised terms.'
      ]
    }
  ];

  return (
    <LegalPage
      title="Terms of Service"
      updatedAt="March 29, 2026"
      intro="These terms govern your use of Telemedicine Hub services and account access."
      sections={sections}
    />
  );
}

function HelpCenterPage() {
  const sections = [
    {
      heading: 'Common Support Topics',
      body: [
        'Login issues: verify email/password and reset credentials if needed.',
        'Call quality issues: use the in-call Data Quality button to switch between Auto, Saver, and High modes.',
        'Delegated helper access: ensure patient consent is active and linked to the helper phone number.'
      ]
    },
    {
      heading: 'Connectivity Tips',
      body: [
        'If your connection is weak, switch to Audio or Text mode from call controls.',
        'Enable Data Saver to reduce bandwidth use during low-connectivity periods.'
      ]
    },
    {
      heading: 'Contact Support',
      body: [
        'Email: support@telemedicinehub.local',
        'Hours: Monday to Saturday, 08:00 to 20:00 local time.',
        'For urgent medical emergencies, contact local emergency responders.'
      ]
    }
  ];

  return (
    <LegalPage
      title="Help Center"
      updatedAt="March 29, 2026"
      intro="Find quick fixes, guidance, and support contacts for your telemedicine journey."
      sections={sections}
    />
  );
}

function RuralSupportLayer() {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [networkType, setNetworkType] = useState(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.effectiveType || 'unknown';
  });
  const [isDataSaver, setIsDataSaver] = useState(() => {
    try {
      return window.localStorage.getItem('rural:dataSaver') === '1';
    } catch (_err) {
      return false;
    }
  });

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const updateNetwork = () => {
      setIsOnline(navigator.onLine);
      setNetworkType(connection?.effectiveType || 'unknown');
    };

    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    connection?.addEventListener?.('change', updateNetwork);

    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      connection?.removeEventListener?.('change', updateNetwork);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('rural:dataSaver', isDataSaver ? '1' : '0');
    } catch (_err) {}

    document.body.classList.toggle('rural-data-saver', isDataSaver);
  }, [isDataSaver]);

  const isCallRoute = /^\/calls\/[^/]+$/.test(location.pathname);
  const networkLabel = isOnline ? `Network: ${networkType}` : 'Offline mode enabled';

  return (
    <>
      {!isCallRoute ? (
        <aside className={`rural-connectivity-banner ${isOnline ? 'online' : 'offline'}`} aria-live="polite">
          <p>
            <span className="material-symbols-outlined" aria-hidden="true">
              {isOnline ? 'network_wifi' : 'wifi_off'}
            </span>
            {networkLabel}
          </p>
          <button type="button" onClick={() => setIsDataSaver((prev) => !prev)}>
            <span className="material-symbols-outlined" aria-hidden="true">
              {isDataSaver ? 'speed_0_5x' : 'speed'}
            </span>
            {isDataSaver ? 'Data Saver ON' : 'Data Saver OFF'}
          </button>
        </aside>
      ) : null}

      <TranslationService />
    </>
  );
}

function ProtectedLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshSession } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  if (!user) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  const userInitial = String(user.fullName || 'U').slice(0, 1).toUpperCase();
  const isCallRoute = /^\/calls\/[^/]+$/.test(location.pathname);
  const isDoctor = user.role === 'doctor';
  const isPatient = user.role === 'patient';
  const isHelper = user.role === 'help_worker';

  const onLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    await refreshSession();
    navigate('/auth/login', { replace: true });
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onDocumentClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onEsc);

    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  if (isCallRoute) {
    return (
      <div className="app-shell call-route-shell">
        <main className="page-wrap call-route-wrap">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <nav className="main-nav unified-nav" aria-label="Primary navigation">
        <div className="brand">
          <h1>Telemedicine Hub</h1>
          <p>Connected care for patients and doctors</p>
        </div>

        <div className="nav-links">
          <Link className="nav-btn" to="/dashboard">
            Home
          </Link>
          {isPatient ? (
            <Link className="nav-btn" to="/book">
              Book Visit
            </Link>
          ) : null}
          <Link className="nav-btn" to="/appointments">
            Appointments
          </Link>
          <Link className="nav-btn" to="/async-consults">
            {isDoctor ? 'Async Queue' : isHelper ? 'Delegated Async' : 'Async Consult'}
          </Link>
          <Link className="nav-btn" to="/reminders">
            Reminders
          </Link>
          <Link className="nav-btn" to="/ai-copilot">
            AI Copilot
          </Link>
          {isPatient ? (
            <Link className="nav-btn" to="/doctors">
              Doctors
            </Link>
          ) : null}
          {isDoctor ? (
            <Link className="nav-btn" to="/doctors/me/slots">
              My Slots
            </Link>
          ) : null}
          {isDoctor ? (
            <Link className="nav-btn" to="/doctors/me/analytics">
              Analytics
            </Link>
          ) : null}
          {isPatient ? (
            <Link className="nav-btn" to="/patients/workspace">
              Family &amp; Records
            </Link>
          ) : null}
          {isPatient || isHelper ? (
            <Link className="nav-btn" to="/support/consents">
              {isHelper ? 'Delegated Support' : 'Care Support'}
            </Link>
          ) : null}
        </div>

        <div className="profile-menu" ref={menuRef}>
          <button
            className="user-chip user-chip-btn sanctuary-profile-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span className="sanctuary-profile-copy" aria-hidden="true">
              <strong>{user.fullName}</strong>
              <span className={`role ${user.role}`}>{user.role}</span>
            </span>
            <span className="sanctuary-profile-avatar">{userInitial}</span>
            <span className="material-symbols-outlined menu-caret" aria-hidden="true">
              arrow_drop_down
            </span>
          </button>

          {menuOpen ? (
            <div className="profile-menu-panel sanctuary-profile-panel" role="menu" aria-label="Profile menu">
              <Link className="profile-menu-item sanctuary-profile-item" to="/profile" role="menuitem">
                <span className="sanctuary-profile-item-icon" aria-hidden="true">
                  <span className="material-symbols-outlined">person</span>
                </span>
                <span>Profile</span>
              </Link>
              {user.role === 'patient' ? (
                <Link className="profile-menu-item sanctuary-profile-item" to="/medicines" role="menuitem">
                  <span className="sanctuary-profile-item-icon" aria-hidden="true">
                    <span className="material-symbols-outlined">pill</span>
                  </span>
                  <span>My Medicines</span>
                </Link>
              ) : null}
              <button className="profile-menu-item danger sanctuary-profile-item" type="button" role="menuitem" onClick={onLogout}>
                <span className="sanctuary-profile-item-icon danger" aria-hidden="true">
                  <span className="material-symbols-outlined">logout</span>
                </span>
                <span>Logout</span>
              </button>
            </div>
          ) : null}
        </div>
      </nav>

      <main className="page-wrap">
        <Outlet />
      </main>
    </div>
  );
}

function AuthCard({ title, subtitle, children }) {
  return (
    <section className="auth-card">
      <p className="kicker">Secure access</p>
      <h2>{title}</h2>
      <p className="muted">{subtitle}</p>
      {children}
    </section>
  );
}

function WelcomePage() {
  const { user } = useSession();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="welcome-layout">
      <section className="welcome-card">
        <p className="kicker">Trusted Telemedicine</p>
        <h1>Your guided healthcare journey starts here</h1>
        <p className="muted">
          Simple steps, clear actions, and support designed for every comfort level.
        </p>

        <div className="welcome-points">
          <article>
            <h3>One task at a time</h3>
            <p className="muted">No complex dashboards. Just clear guidance for what to do next.</p>
          </article>
          <article>
            <h3>Built for low bandwidth</h3>
            <p className="muted">Fast, lightweight screens that work reliably in rural settings.</p>
          </article>
          <article>
            <h3>Family-friendly care</h3>
            <p className="muted">Book visits for yourself or loved ones from the same account.</p>
          </article>
        </div>

        <div className="welcome-actions">
          <Link className="btn large" to="/auth/login">
            Continue to Login
          </Link>
          <Link className="btn subtle large" to="/auth/register">
            Create New Account
          </Link>
        </div>
      </section>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshSession } = useSession();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: form
      });

      if (!res.ok) {
        setError(res.data?.error || 'Login failed.');
        return;
      }

      await refreshSession();

      const destination = res.data?.redirectTo || location.state?.from || '/dashboard';
      navigate(destination, { replace: true });
    } catch (_err) {
      setError('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-experience auth-login-experience">
      <main className="auth-login-main">
        <section className="auth-login-showcase" aria-hidden="true">
          <div className="auth-login-showcase-image" />
          <div className="auth-login-showcase-card">
            <span className="auth-brand-mark">The Guided Journey</span>
            <h1>Your path to wellness starts with a single step.</h1>
            <p>
              Accessible telemedicine designed for rural living, bringing high-trust healthcare directly to your
              home clearing.
            </p>
          </div>
        </section>

        <section className="auth-login-panel">
          <div className="auth-mobile-brand">The Guided Journey</div>

          <div className="auth-login-panel-inner">
            <header className="auth-login-header">
              <h2>Welcome back</h2>
              <p>Please enter your details to access your sanctuary.</p>
            </header>

            {error ? <p className="auth-inline-error">{error}</p> : null}

            <form className="auth-form-stack" onSubmit={onSubmit}>
              <label className="auth-field-label" htmlFor="loginEmail">Email Address</label>
              <div className="auth-field-shell">
                <span className="material-symbols-outlined" aria-hidden="true">mail</span>
                <input
                  id="loginEmail"
                  type="email"
                  autoComplete="username"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="auth-field-head">
                <label className="auth-field-label" htmlFor="loginPassword">Password</label>
                <a
                  className="auth-inline-link"
                  href="#"
                  onClick={(event) => event.preventDefault()}
                >
                  Forgot Password?
                </a>
              </div>
              <div className="auth-field-shell">
                <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                <input
                  id="loginPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
                <button
                  className="auth-input-toggle"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              <label className="auth-checkbox-row" htmlFor="rememberDevice">
                <input
                  id="rememberDevice"
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(event) => setRememberDevice(event.target.checked)}
                />
                <span>Remember this device for 30 days</span>
              </label>

              <button className="auth-submit-btn" type="submit" disabled={busy}>
                {busy ? 'Signing in...' : 'Login'}
                <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
              </button>
            </form>

            <div className="auth-divider">
              <span />
              <small>OR CONTINUE WITH</small>
              <span />
            </div>

            <div className="auth-social-grid">
              <button className="auth-social-btn" type="button">
                <span className="auth-social-badge">G</span>
                <span>Google</span>
              </button>
              <button className="auth-social-btn" type="button">
                <span className="material-symbols-outlined" aria-hidden="true">phone_iphone</span>
                <span>Apple</span>
              </button>
            </div>

            <p className="auth-switch-note">
              New to The Guided Journey?
              <Link to="/auth/register">Create an account</Link>
            </p>
          </div>

          <footer className="auth-login-footer">
            <div className="auth-footer-links">
              <Link to="/privacy-policy">Privacy Policy</Link>
              <Link to="/terms-of-service">Terms of Service</Link>
              <Link to="/help-center">Help Center</Link>
            </div>
          </footer>
        </section>
      </main>

      <Link className="auth-help-fab" to="/help-center">
        <span>Need help?</span>
        <span className="auth-help-icon">
          <span className="material-symbols-outlined" aria-hidden="true">support_agent</span>
        </span>
      </Link>
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const { user, refreshSession } = useSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'patient',
    adminInviteCode: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    language: '',
    timeZone: '',
    specialization: '',
    yearsOfExperience: '',
    qualifications: '',
    clinicName: '',
    consultationLanguages: '',
    description: ''
  });

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: form
      });

      if (!res.ok) {
        setError(res.data?.error || 'Registration failed.');
        return;
      }

      await refreshSession();
      navigate(res.data?.redirectTo || '/dashboard', { replace: true });
    } catch (_err) {
      setError('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-register-shell">
      <main className="auth-register-main">
        <section className="auth-register-hero">
          <div className="auth-register-icon-wrap">
            <span className="material-symbols-outlined" aria-hidden="true">health_and_safety</span>
          </div>
          <h1>The Guided Journey</h1>
          <p>
            Your path to wellness starts here. Join our community for compassionate, rural-focused care.
          </p>
        </section>

        <section className="auth-register-card">
          {error ? <p className="auth-inline-error">{error}</p> : null}

          <form className="auth-register-form" onSubmit={onSubmit}>
            <div className="auth-register-grid">
              <label>
                Full Name
                <input
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Johnathan Doe"
                  required
                />
              </label>
              <label>
                Email Address
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                  required
                />
              </label>
              <label>
                Phone Number
                <input
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 000-0000"
                  required={form.role === 'help_worker'}
                />
              </label>
              <label>
                Choose Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
              </label>
              <label>
                Role
                <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="help_worker">Help Worker</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label>
                Admin Invite Code
                <input
                  value={form.adminInviteCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, adminInviteCode: e.target.value }))}
                  placeholder="Only required for admin"
                />
              </label>
              <label>
                Gender
                <input
                  value={form.gender}
                  onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
                />
              </label>
              <label>
                Date of Birth
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                />
              </label>
              <label className="auth-register-wide">
                Address
                <input
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  required={form.role === 'help_worker'}
                />
              </label>
              <label>
                Language
                <input
                  value={form.language}
                  onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
                  required={form.role === 'help_worker'}
                />
              </label>
              <label>
                Time Zone
                <input
                  value={form.timeZone}
                  onChange={(e) => setForm((prev) => ({ ...prev, timeZone: e.target.value }))}
                  placeholder="Asia/Kolkata"
                />
              </label>
            </div>

            {form.role === 'doctor' ? (
              <div className="auth-doctor-section">
                <h3>Doctor Details</h3>
                <div className="auth-register-grid">
                  <label>
                    Specialization
                    <input
                      value={form.specialization}
                      onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))}
                    />
                  </label>
                  <label>
                    Experience (years)
                    <input
                      type="number"
                      value={form.yearsOfExperience}
                      onChange={(e) => setForm((prev) => ({ ...prev, yearsOfExperience: e.target.value }))}
                    />
                  </label>
                  <label>
                    Qualifications
                    <input
                      value={form.qualifications}
                      onChange={(e) => setForm((prev) => ({ ...prev, qualifications: e.target.value }))}
                    />
                  </label>
                  <label>
                    Clinic / Hospital
                    <input
                      value={form.clinicName}
                      onChange={(e) => setForm((prev) => ({ ...prev, clinicName: e.target.value }))}
                    />
                  </label>
                  <label className="auth-register-wide">
                    Consultation Languages
                    <input
                      value={form.consultationLanguages}
                      onChange={(e) => setForm((prev) => ({ ...prev, consultationLanguages: e.target.value }))}
                      placeholder="English, Hindi"
                    />
                  </label>
                  <label className="auth-register-wide">
                    Description
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {form.role === 'help_worker' ? (
              <div className="auth-doctor-section">
                <h3>Help Worker Details</h3>
                <p className="muted">Phone, address, and language are required so patients can link consent records to your helper account.</p>
              </div>
            ) : null}

            <button className="auth-register-submit" type="submit" disabled={busy}>
              {busy ? 'Creating account...' : 'Create account'}
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </button>

            <div className="auth-register-switch">
              <p>Already have an account?</p>
              <Link to="/auth/login">Log in to your journey</Link>
            </div>
          </form>
        </section>

        <section className="auth-register-trust-grid">
          <article>
            <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
            <div>
              <h3>Secure Data</h3>
              <p>Protected patient information</p>
            </div>
          </article>
          <article>
            <span className="material-symbols-outlined" aria-hidden="true">local_hospital</span>
            <div>
              <h3>Local Network</h3>
              <p>Real doctors, real care</p>
            </div>
          </article>
        </section>
      </main>

      <footer className="auth-register-footer">
        <div>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms-of-service">Terms of Service</Link>
          <span>•</span>
          <Link to="/help-center">Help Center</Link>
        </div>
      </footer>
    </div>
  );
}

function DashboardPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const isDoctor = user.role === 'doctor';
  const isPatient = user.role === 'patient';
  const isHelper = user.role === 'help_worker';

  const handleSeeDoctorNow = async () => {
    setBusy(true);
    setMessage('Finding the best doctor for you...');

    try {
      const onlineRes = await apiRequest('/api/doctors?online=online');
      const onlineDoctors = onlineRes.ok ? onlineRes.data?.doctors || [] : [];

      const fallbackRes = onlineDoctors.length > 0 ? null : await apiRequest('/api/doctors');
      const doctors = onlineDoctors.length > 0 ? onlineDoctors : fallbackRes?.data?.doctors || [];

      if (doctors.length === 0) {
        setMessage('No doctors are available right now. Please try booking a visit.');
        return;
      }

      const targetDoctor = doctors[0];
      navigate(`/book?doctorId=${encodeURIComponent(targetDoctor.id)}&urgent=1`);
    } catch (_err) {
      setMessage('We could not find a doctor right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sanctuary-dashboard">
      <header className="sanctuary-hero">
        <h2 className="sanctuary-title">How can we help you today, {user.fullName}?</h2>
        <p className="sanctuary-subtitle">
          Your health journey is our priority. Choose a path below to get started.
        </p>
      </header>

      {message ? <p className="sanctuary-status-note">{message}</p> : null}

      <div className="sanctuary-grid" role="list" aria-label="Dashboard actions">
        {isPatient ? (
          <button
            type="button"
            className="sanctuary-action sanctuary-action-urgent"
            onClick={handleSeeDoctorNow}
            disabled={busy}
          >
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              medical_services
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">stethoscope</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>See a Doctor Now</strong>
              <span>Immediate care for urgent health concerns.</span>
            </span>
          </button>
        ) : isDoctor ? (
          <Link className="sanctuary-action sanctuary-action-urgent" to="/appointments">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              medical_services
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">calendar_month</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>My Appointments</strong>
              <span>Open your consultation queue and current sessions.</span>
            </span>
          </Link>
        ) : isHelper ? (
          <Link className="sanctuary-action sanctuary-action-urgent" to="/support/consents">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              volunteer_activism
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">handshake</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Consent Dashboard</strong>
              <span>Review active delegations linked to your helper profile.</span>
            </span>
          </Link>
        ) : (
          <Link className="sanctuary-action sanctuary-action-urgent" to="/appointments">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              medical_services
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">calendar_month</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>All Appointments</strong>
              <span>Open the system appointment timeline.</span>
            </span>
          </Link>
        )}

        {isPatient ? (
          <Link className="sanctuary-action sanctuary-action-book" to="/book">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              calendar_month
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">calendar_today</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Book a Visit</strong>
              <span>Schedule a consultation at your convenience.</span>
            </span>
          </Link>
        ) : isDoctor ? (
          <Link className="sanctuary-action sanctuary-action-book" to="/doctors/me/slots">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              calendar_month
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">schedule</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Manage Slots</strong>
              <span>Update your availability and consultation windows.</span>
            </span>
          </Link>
        ) : isHelper ? (
          <Link className="sanctuary-action sanctuary-action-book" to="/async-consults">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              forum
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">chat</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Delegated Async Consults</strong>
              <span>Start and follow patient consult threads with consent.</span>
            </span>
          </Link>
        ) : (
          <Link className="sanctuary-action sanctuary-action-book" to="/appointments/impact">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              insights
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">analytics</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Operations Impact</strong>
              <span>Track high-level delivery metrics.</span>
            </span>
          </Link>
        )}

        {isPatient ? (
          <Link className="sanctuary-action sanctuary-action-neutral" to="/medicines">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              medication
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">pill</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>My Medicines</strong>
              <span>View prescriptions and manage your refills.</span>
            </span>
          </Link>
        ) : isDoctor ? (
          <Link className="sanctuary-action sanctuary-action-neutral" to="/appointments/impact">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              monitoring
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">monitor_heart</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Consultation Impact</strong>
              <span>Track completion rates, urgency, and follow-up load.</span>
            </span>
          </Link>
        ) : isHelper ? (
          <Link className="sanctuary-action sanctuary-action-neutral" to="/reminders">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              notifications
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">schedule</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Care Reminders</strong>
              <span>See reminder timelines for delegated patients.</span>
            </span>
          </Link>
        ) : (
          <Link className="sanctuary-action sanctuary-action-neutral" to="/appointments">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              list_alt
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">event_note</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Appointment List</strong>
              <span>Review scheduled consultations.</span>
            </span>
          </Link>
        )}

        {isPatient ? (
          <Link className="sanctuary-action sanctuary-action-neutral" to="/patients/workspace">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              group
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">family_restroom</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Family Health</strong>
              <span>Coordinate healthcare for your loved ones.</span>
            </span>
          </Link>
        ) : isDoctor ? (
          <Link className="sanctuary-action sanctuary-action-neutral" to="/doctors/me/analytics">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              bar_chart
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">insights</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Practice Insights</strong>
              <span>Review weekly outcomes and consultation trends.</span>
            </span>
          </Link>
        ) : isHelper ? (
          <Link className="sanctuary-action sanctuary-action-neutral" to="/appointments">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              calendar_month
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">event_available</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Delegated Appointments</strong>
              <span>Open appointments where consent allows helper support.</span>
            </span>
          </Link>
        ) : (
          <Link className="sanctuary-action sanctuary-action-neutral" to="/doctors">
            <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
              stethoscope
            </span>
            <span className="sanctuary-icon-badge" aria-hidden="true">
              <span className="material-symbols-outlined">groups</span>
            </span>
            <span className="sanctuary-action-content">
              <strong>Doctor Network</strong>
              <span>Browse the active clinician directory.</span>
            </span>
          </Link>
        )}

        <Link className="sanctuary-action sanctuary-action-neutral" to="/ai-copilot">
          <span className="material-symbols-outlined sanctuary-bg-icon" aria-hidden="true">
            smart_toy
          </span>
          <span className="sanctuary-icon-badge" aria-hidden="true">
            <span className="material-symbols-outlined">auto_awesome</span>
          </span>
          <span className="sanctuary-action-content">
            <strong>AI Copilot Workspace</strong>
            <span>Draft notes, summaries, reminders, guidance, and translations safely.</span>
          </span>
        </Link>
      </div>

      <div className="sanctuary-user-chip" aria-label="Current signed-in user">
        <span className="sanctuary-user-avatar" aria-hidden="true">
          {String(user.fullName || 'U').slice(0, 1).toUpperCase()}
        </span>
        <span className="sanctuary-user-text">Logged in as {user.fullName}</span>
        <span className="sanctuary-user-dot" aria-hidden="true" />
      </div>
    </section>
  );
}

function BookingWizardPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const preselectedDoctorId = searchParams.get('doctorId') || '';
  const urgentMode = searchParams.get('urgent') === '1';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('Preparing your guided booking journey...');

  const [familyMembers, setFamilyMembers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorDetail, setDoctorDetail] = useState(null);

  const [selectedFor, setSelectedFor] = useState('self');
  const [selectedSymptom, setSelectedSymptom] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [mode, setMode] = useState('video');

  const symptomOptions = [
    { id: 'fever', icon: 'thermometer', label: 'Fever', hint: 'High temperature or chills' },
    { id: 'pain', icon: 'bolt', label: 'Pain', hint: 'Aches, sharp pain, or soreness' },
    { id: 'injury', icon: 'personal_injury', label: 'Injury', hint: 'Cuts, sprains, or bruises' },
    { id: 'skin', icon: 'dermatology', label: 'Skin Issue', hint: 'Rashes, itching, or bumps' },
    { id: 'cough', icon: 'pulmonology', label: 'Cold/Cough', hint: 'Congestion, sore throat' },
    { id: 'other', icon: 'more_horiz', label: 'Other', hint: 'Something else not listed' }
  ];

  const modeOptions = [
    { id: 'video', icon: 'videocam', label: 'Video', hint: 'High quality' },
    { id: 'audio', icon: 'call', label: 'Voice', hint: 'Clear audio' },
    { id: 'text', icon: 'chat_bubble', label: 'Text', hint: 'Asynchronous' }
  ];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setMessage('Finding caring doctors near you...');

      try {
        const doctorsRes = await apiRequest('/api/doctors');
        if (doctorsRes.status === 401) {
          navigate('/auth/login', { replace: true });
          return;
        }
        if (!doctorsRes.ok) {
          setError(doctorsRes.data?.error || 'Unable to load doctors right now.');
          return;
        }

        const loadedDoctors = doctorsRes.data?.doctors || [];
        setDoctors(loadedDoctors);

        if (user.role === 'patient') {
          const workspaceRes = await apiRequest('/api/patients/workspace');
          if (workspaceRes.ok) {
            setFamilyMembers(workspaceRes.data?.user?.familyMembers || []);
          }
        }

        const doctorIdToSelect = preselectedDoctorId || (urgentMode ? loadedDoctors[0]?.id : '');
        if (doctorIdToSelect) {
          setSelectedDoctorId(doctorIdToSelect);
          setStep(3);
        }

        setMessage('Choose who this consultation is for.');
      } catch (_err) {
        setError('Unable to start booking wizard. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate, preselectedDoctorId, urgentMode, user.role]);

  useEffect(() => {
    if (!selectedDoctorId) {
      setDoctorDetail(null);
      return;
    }

    const loadDoctor = async () => {
      setDoctorLoading(true);
      setError('');
      setMessage('Checking available time slots...');

      try {
        const res = await apiRequest(`/api/doctors/${selectedDoctorId}`);
        if (!res.ok) {
          setError(res.data?.error || 'Unable to load doctor profile.');
          return;
        }
        setDoctorDetail(res.data);
        setMessage('Great. Now pick a convenient time.');
      } catch (_err) {
        setError('Could not load slot availability.');
      } finally {
        setDoctorLoading(false);
      }
    };

    loadDoctor();
  }, [selectedDoctorId]);

  const availableByDate = useMemo(() => {
    const grouped = {};
    (doctorDetail?.slots || [])
      .filter((slot) => slot.status === 'available')
      .forEach((slot) => {
        const date = new Date(slot.startAt).toISOString().slice(0, 10);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(slot);
      });

    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    });

    return grouped;
  }, [doctorDetail]);

  useEffect(() => {
    const dates = Object.keys(availableByDate).sort();
    if (!dates.length) return;

    if (!selectedDate || !availableByDate[selectedDate]) {
      setSelectedDate(dates[0]);
      setSelectedSlotId(availableByDate[dates[0]][0]?.id || '');
      return;
    }

    const slotStillExists = availableByDate[selectedDate].some((slot) => slot.id === selectedSlotId);
    if (!slotStillExists) {
      setSelectedSlotId(availableByDate[selectedDate][0]?.id || '');
    }
  }, [availableByDate, selectedDate, selectedSlotId]);

  if (user.role === 'doctor') {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.role !== 'patient') {
    return (
      <section className="card">
        <h2>Booking Wizard</h2>
        <p className="muted">The guided booking wizard is available for patient accounts.</p>
        <div className="row-inline">
          <Link className="btn" to="/doctors">
            Browse Doctors
          </Link>
          <Link className="btn subtle" to="/appointments">
            View Appointments
          </Link>
        </div>
      </section>
    );
  }

  const canContinue =
    (step === 1 && Boolean(selectedFor)) ||
    (step === 2 && Boolean(selectedSymptom)) ||
    (step === 3 && Boolean(selectedDoctorId)) ||
    (step === 4 && Boolean(selectedSlotId));

  const submitBooking = async () => {
    setBusy(true);
    setError('');
    setMessage('Finalizing your appointment...');

    try {
      const res = await apiRequest('/api/appointments/book', {
        method: 'POST',
        body: {
          slotId: selectedSlotId,
          mode,
          familyMemberId: selectedFor === 'self' ? '' : selectedFor
        }
      });

      if (!res.ok) {
        setError(res.data?.error || res.data?.message || 'Unable to book appointment.');
        return;
      }

      navigate(res.data?.redirectTo || '/appointments');
    } catch (_err) {
      setError('Booking failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const slotDates = Object.keys(availableByDate).sort();
  const selectedSlots = availableByDate[selectedDate] || [];
  const selectedSymptomMeta = symptomOptions.find((symptom) => symptom.id === selectedSymptom);

  const stepHeader =
    step === 1
      ? {
          chip: 'Step 1 of 4',
          title: 'Who needs help?',
          subtitle:
            "Select the patient profile for this consultation. We'll tailor the experience using their history."
        }
      : step === 2
        ? {
            chip: 'Step 2 of 4',
            title: 'What is the problem?',
            subtitle:
              'Select the primary symptom that is troubling today so we can route you to the right specialist.'
          }
        : step === 3
          ? {
              chip: 'Step 3 of 4',
              title: 'Choose your Doctor',
              subtitle: 'Pick a specialist who best fits your needs and availability.'
            }
          : {
              chip: 'Step 4 of 4',
              title: 'Find the perfect clearing in your day.',
              subtitle: 'Choose consultation mode, date, and time slot before confirming your booking.'
            };

  return (
    <section className="booking-sanctuary-shell">
      <header className="booking-sanctuary-header">
        <div className="booking-step-chip">{stepHeader.chip}</div>
        <h2>{stepHeader.title}</h2>
        <p>{stepHeader.subtitle}</p>
      </header>

      <div className="booking-progress-track" aria-label="Booking progress">
        {[1, 2, 3, 4].map((index) => (
          <span className={index <= step ? 'active' : ''} key={index} />
        ))}
      </div>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Preparing your guided booking journey...</p> : null}
      {!loading ? <p className="muted booking-status-note">{message}</p> : null}

      {!loading && step === 1 ? (
        <div className="booking-profile-grid">
          <button
            type="button"
            className={`booking-profile-card ${selectedFor === 'self' ? 'selected' : ''}`}
            onClick={() => setSelectedFor('self')}
          >
            <div className="booking-profile-avatar">{String(user.fullName || 'U').slice(0, 1).toUpperCase()}</div>
            <strong>Myself</strong>
            <p>Primary account holder</p>
          </button>

          {familyMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              className={`booking-profile-card ${selectedFor === member.id ? 'selected' : ''}`}
              onClick={() => setSelectedFor(member.id)}
            >
              <div className="booking-profile-avatar">{String(member.fullName || 'F').slice(0, 1).toUpperCase()}</div>
              <strong>{member.fullName}</strong>
              <p>{member.relationToPatient || 'Dependent profile'}</p>
            </button>
          ))}

          <Link className="booking-profile-card add-dependent" to="/patients/workspace">
            <div className="booking-profile-add-icon">
              <span className="material-symbols-outlined" aria-hidden="true">person_add</span>
            </div>
            <strong>Add dependent</strong>
            <p>Family member or legal ward</p>
          </Link>
        </div>
      ) : null}

      {!loading && step === 2 ? (
        <>
          <div className="booking-symptom-grid">
            {symptomOptions.map((symptom) => (
              <button
                key={symptom.id}
                type="button"
                className={`booking-symptom-card ${selectedSymptom === symptom.id ? 'selected' : ''}`}
                onClick={() => setSelectedSymptom(symptom.id)}
              >
                <div className="booking-symptom-icon" aria-hidden="true">
                  <span className="material-symbols-outlined">{symptom.icon}</span>
                </div>
                <strong>{symptom.label}</strong>
                <p>{symptom.hint}</p>
              </button>
            ))}
          </div>

          <article className="booking-emergency-card">
            <div>
              <span className="booking-emergency-chip">Security First</span>
              <h3>Emergency Support</h3>
              <p>
                If you have severe breathing issues, chest pain, or heavy bleeding, seek immediate emergency care nearby.
              </p>
            </div>
            <button type="button" className="booking-emergency-btn">
              <span className="material-symbols-outlined" aria-hidden="true">call</span>
              Call Emergency Services
            </button>
          </article>
        </>
      ) : null}

      {!loading && step === 3 ? (
        <>
          {doctors.length === 0 ? <p className="journey-empty-note">No doctors found right now.</p> : null}
          <div className="booking-doctor-list">
            {doctors.map((doctor) => (
              <article
                className={`booking-doctor-card ${selectedDoctorId === doctor.id ? 'selected' : ''}`}
                key={doctor.id}
              >
                <div className="booking-doctor-avatar">{String(doctor.fullName || 'D').slice(0, 1).toUpperCase()}</div>
                <div className="booking-doctor-content">
                  <h3>Dr. {doctor.fullName}</h3>
                  <p className="booking-doctor-specialty">{doctor.doctorProfile?.specialization || 'General Medicine'}</p>
                  <div className="booking-doctor-meta">
                    <span className={`pill ${doctor.online ? 'online' : 'offline'}`}>
                      {doctor.online ? 'online now' : 'next available'}
                    </span>
                    <span className="muted">{formatDoctorRating(doctor.ratingAverage, doctor.ratingCount)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedDoctorId(doctor.id)}>
                  Select Doctor
                </button>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {!loading && step === 4 ? (
        <div className="booking-time-shell">
          {doctorLoading ? <p className="muted">Finding the best doctor for you and checking slots...</p> : null}

          <section>
            <h3>Consultation Mode</h3>
            <div className="booking-mode-grid">
              {modeOptions.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`booking-mode-card ${mode === option.id ? 'selected' : ''}`}
                  onClick={() => setMode(option.id)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{option.icon}</span>
                  <strong>{option.label}</strong>
                  <p>{option.hint}</p>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="booking-date-head">
              <h3>Select Date</h3>
              <span>{slotDates.length} available days</span>
            </div>
            <div className="booking-date-row">
              {slotDates.length === 0 ? <p className="journey-empty-note">No dates available.</p> : null}
              {slotDates.map((date) => (
                <button
                  type="button"
                  key={date}
                  className={`booking-date-chip ${selectedDate === date ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedSlotId(availableByDate[date]?.[0]?.id || '');
                  }}
                >
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Available Slots</h3>
            <div className="booking-slot-grid">
              {selectedSlots.length === 0 ? <p className="journey-empty-note">No slots for selected date.</p> : null}
              {selectedSlots.map((slot) => (
                <button
                  type="button"
                  key={slot.id}
                  className={`booking-slot-chip ${selectedSlotId === slot.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSlotId(slot.id)}
                >
                  {utcDateTime(slot.startAt).slice(11, 16)} UTC
                </button>
              ))}
            </div>
          </section>

          <article className="booking-summary-card">
            <p>
              <strong>For:</strong>{' '}
              {selectedFor === 'self'
                ? user.fullName
                : familyMembers.find((member) => member.id === selectedFor)?.fullName || 'Family member'}
            </p>
            <p>
              <strong>Reason:</strong> {selectedSymptomMeta?.label || 'Not selected'}
            </p>
            <p>
              <strong>Doctor:</strong>{' '}
              {doctors.find((doctor) => doctor.id === selectedDoctorId)?.fullName || 'Not selected'}
            </p>
          </article>
        </div>
      ) : null}

      <div className="booking-action-bar">
        <button type="button" className="booking-back-btn" onClick={() => setStep((prev) => Math.max(1, prev - 1))} disabled={step === 1 || busy}>
          {step === 1 ? 'Cancel Booking' : 'Back'}
        </button>

        {step < 4 ? (
          <button type="button" className="booking-next-btn" onClick={() => setStep((prev) => Math.min(4, prev + 1))} disabled={!canContinue || busy}>
            Continue
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </button>
        ) : (
          <button type="button" className="booking-next-btn" onClick={submitBooking} disabled={!canContinue || busy}>
            {busy ? 'Booking...' : 'Confirm Booking'}
            <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
          </button>
        )}
      </div>
    </section>
  );
}

function MedicineCabinetPage() {
  const { user } = useSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const workspaceRes = await apiRequest('/api/patients/workspace');
      if (!workspaceRes.ok) {
        setError(workspaceRes.data?.error || 'Unable to load medicine records.');
        return;
      }

      const completed = (workspaceRes.data?.completedAppointments || []).filter((item) => Boolean(item.prescription));
      const detailed = await Promise.all(
        completed.map(async (appointment) => {
          const detailsRes = await apiRequest(`/api/prescriptions/${appointment.id}`);
          return {
            id: appointment.id,
            startAt: appointment.startAt,
            doctorName: appointment.doctor?.fullName || 'Doctor',
            diagnosis: appointment.prescription?.diagnosis || 'No diagnosis',
            handoffCode: detailsRes.ok ? detailsRes.data?.handoffCode || 'Open prescription' : 'Open prescription'
          };
        })
      );

      setItems(detailed);
    } catch (_err) {
      setError('Unable to load medicine cabinet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user.role !== 'patient') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <section className="card">
        <p className="kicker">Medicine Cabinet</p>
        <h2>Your prescriptions and handoff cards</h2>
        <p className="muted">Keep these cards ready when visiting a pharmacy or planning a follow-up.</p>
      </section>

      {loading ? <p className="muted">Organizing your medicine records...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && items.length === 0 ? <p className="muted">No medicine records found yet.</p> : null}

      <section className="medicine-grid">
        {items.map((item) => (
          <article className="card handoff-card" key={item.id}>
            <p className="muted">{utcDateTime(item.startAt)}</p>
            <h3>{item.diagnosis}</h3>
            <p className="muted">Doctor: {item.doctorName}</p>

            {item.handoffCode ? (
              <div className="handoff-code-block">
                <p className="kicker">Handoff Code</p>
                <p className="handoff-code">{item.handoffCode}</p>
              </div>
            ) : null}

            <div className="row-inline">
              <Link className="btn" to={`/prescriptions/${item.id}`}>
                View Card
              </Link>
              <a className="btn subtle" href={`/api/prescriptions/${item.id}/pdf`} target="_blank" rel="noreferrer">
                Download
              </a>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function useApiPage(path) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const readCached = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(`api-cache:${path}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  }, [path]);

  const writeCached = useCallback(
    (value) => {
      try {
        window.localStorage.setItem(`api-cache:${path}`, JSON.stringify(value));
      } catch (_err) {}
    },
    [path]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await apiRequest(path);
      if (res.status === 401) {
        navigate('/auth/login', { replace: true });
        return;
      }
      if (!res.ok) {
        const cached = readCached();
        if (cached) {
          setData(cached);
          setError('Live data unavailable. Showing last saved copy.');
          return;
        }
        setError(res.data?.error || 'Failed to load page.');
        return;
      }
      if (res.data?.redirectTo) {
        navigate(res.data.redirectTo);
        return;
      }
      setData(res.data);
      writeCached(res.data);
    } catch (_err) {
      const cached = readCached();
      if (cached) {
        setData(cached);
        setError('You appear offline. Showing last saved copy.');
        return;
      }
      setError('Unable to load data.');
    } finally {
      setLoading(false);
    }
  }, [path, navigate, readCached, writeCached]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, setData, error, loading, reload: load };
}

function DoctorsPage() {
  const { user } = useSession();
  const [filters, setFilters] = useState({ specialization: '', language: '', online: 'all' });
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchDoctors = useCallback(async () => {
    if (user.role === 'doctor') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const qs = new URLSearchParams();
    if (filters.specialization) qs.set('specialization', filters.specialization);
    if (filters.language) qs.set('language', filters.language);
    if (filters.online) qs.set('online', filters.online);

    try {
      const res = await apiRequest(`/api/doctors?${qs.toString()}`);
      if (res.status === 401) {
        navigate('/auth/login');
        return;
      }
      if (!res.ok) {
        setError(res.data?.error || 'Failed to load doctors.');
        return;
      }
      if (res.data?.redirectTo) {
        navigate(res.data.redirectTo);
        return;
      }
      setPayload(res.data);
    } catch (_err) {
      setError('Unable to load doctors.');
    } finally {
      setLoading(false);
    }
  }, [filters, navigate, user.role]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  if (user.role === 'doctor') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <section className="journey-hero">
        <h2 className="journey-title">
          Find your <span className="journey-accent">trusted</span> specialist.
        </h2>
        <p className="journey-sub">
          Expert care is just a moment away. Search from our verified network of doctors ready to guide your health journey.
        </p>
      </section>

      <section className="journey-controls-grid">
        <div className="journey-search-shell">
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <input
            value={filters.specialization}
            onChange={(e) => setFilters((prev) => ({ ...prev, specialization: e.target.value }))}
            placeholder="Search by name, specialty, or clinic..."
          />
        </div>

        <div className="journey-filter-shell">
          <label>
            <span className="material-symbols-outlined" aria-hidden="true">language</span>
            <input
              value={filters.language}
              onChange={(e) => setFilters((prev) => ({ ...prev, language: e.target.value }))}
              placeholder="Language"
            />
          </label>
        </div>
      </section>

      <section className="journey-pill-row" aria-label="Doctor availability filters">
        <button
          type="button"
          className={`journey-pill ${filters.online === 'all' ? 'active' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, online: 'all' }))}
        >
          All Doctors
        </button>
        <button
          type="button"
          className={`journey-pill ${filters.online === 'online' ? 'active' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, online: 'online' }))}
        >
          Online Now
        </button>
        <button
          type="button"
          className={`journey-pill ${filters.online === 'offline' ? 'active' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, online: 'offline' }))}
        >
          Offline
        </button>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading doctors...</p> : null}

      <section className="journey-doctors-grid">
        {(payload?.doctors || []).map((doctor) => (
          <article className="journey-doctor-card" key={doctor.id}>
            <div className="journey-doctor-top">
              <div className="journey-doctor-avatar">{String(doctor.fullName || 'D').slice(0, 1).toUpperCase()}</div>
              <span className={`journey-online-badge ${doctor.online ? 'online' : 'offline'}`}>
                <span className="journey-dot" />
                {doctor.online ? 'online' : 'offline'}
              </span>
            </div>

            <div className="journey-doctor-content">
              <h3>Dr. {doctor.fullName}</h3>
              <p className="journey-specialty">{doctor.doctorProfile?.specialization || 'General Medicine'}</p>
              <p className="journey-meta">{formatDoctorRating(doctor.ratingAverage, doctor.ratingCount)}</p>
              <p className="journey-meta">
                {doctor.doctorProfile?.consultationLanguages
                  ? `Languages: ${doctor.doctorProfile.consultationLanguages}`
                  : 'Languages: Not specified'}
              </p>
            </div>

            <Link className="journey-cta" to={`/doctors/${doctor.id}`}>
              View and book
            </Link>
          </article>
        ))}

        {!loading && (payload?.doctors || []).length === 0 ? (
          <article className="journey-doctor-empty">
            <span className="material-symbols-outlined" aria-hidden="true">clinical_notes</span>
            <p>No doctors match your current filters.</p>
          </article>
        ) : null}
      </section>
    </>
  );
}

function DoctorDetailPage() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data, error, loading } = useApiPage(`/api/doctors/${doctorId}`);
  const [slotDate, setSlotDate] = useState('');
  const [slotId, setSlotId] = useState('');
  const [mode, setMode] = useState('video');
  const [familyMemberId, setFamilyMemberId] = useState('');
  const [message, setMessage] = useState('');

  const availableByDate = useMemo(() => {
    const result = {};
    (data?.slots || [])
      .filter((slot) => slot.status === 'available')
      .forEach((slot) => {
        const date = new Date(slot.startAt).toISOString().slice(0, 10);
        if (!result[date]) result[date] = [];
        result[date].push(slot);
      });

    Object.keys(result).forEach((date) => {
      result[date].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    });

    return result;
  }, [data]);

  useEffect(() => {
    const dates = Object.keys(availableByDate).sort();
    if (!dates.length) return;
    if (!slotDate || !availableByDate[slotDate]) {
      setSlotDate(dates[0]);
      setSlotId(availableByDate[dates[0]][0]?.id || '');
      return;
    }
    const hasSlot = availableByDate[slotDate].some((slot) => slot.id === slotId);
    if (!hasSlot) {
      setSlotId(availableByDate[slotDate][0]?.id || '');
    }
  }, [availableByDate, slotDate, slotId]);

  const submitBooking = async (event) => {
    event.preventDefault();
    setMessage('');
    if (!slotId) {
      setMessage('Please select a slot.');
      return;
    }

    const res = await apiRequest('/api/appointments/book', {
      method: 'POST',
      body: {
        slotId,
        mode,
        familyMemberId
      }
    });

    if (!res.ok) {
      setMessage(res.data?.error || res.data?.message || 'Booking failed.');
      return;
    }

    if (res.data?.redirectTo) {
      navigate(res.data.redirectTo);
      return;
    }

    setMessage('Booked.');
  };

  if (loading) return <p className="muted">Loading doctor profile...</p>;
  if (error) return <p className="error">{error}</p>;

  const slotDates = Object.keys(availableByDate).sort();
  const selectedSlots = availableByDate[slotDate] || [];

  return (
    <>
      <section className="card">
        <h2>Dr. {data?.doctor?.fullName}</h2>
        <p className="muted">{data?.doctor?.doctorProfile?.specialization || 'General'} specialist</p>
        <p className="muted">{formatDoctorRating(data?.doctorRating?.average, data?.doctorRating?.count)}</p>
        <p>{data?.doctor?.doctorProfile?.description || 'No description available.'}</p>
        <span className={`pill ${data?.doctorOnline ? 'online' : 'offline'}`}>
          {data?.doctorOnline ? 'online' : 'offline'}
        </span>
      </section>

      <section className="card">
        <h3>Book appointment</h3>
        {message ? <p className={message.toLowerCase().includes('failed') ? 'error' : 'success'}>{message}</p> : null}

        {user.role !== 'patient' ? <p className="muted">Only patient accounts can book appointments.</p> : null}

        {user.role === 'patient' ? (
          <form className="stack" onSubmit={submitBooking}>
            <label>
              Date
              <select value={slotDate} onChange={(e) => setSlotDate(e.target.value)}>
                {slotDates.length === 0 ? <option value="">No dates available</option> : null}
                {slotDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Time slot
              <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                {selectedSlots.length === 0 ? <option value="">No slots</option> : null}
                {selectedSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {utcDateTime(slot.startAt)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Mode
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="text">Text</option>
              </select>
            </label>

            <label>
              For
              <select value={familyMemberId} onChange={(e) => setFamilyMemberId(e.target.value)}>
                <option value="">Self ({user.fullName})</option>
                {(data?.familyMembers || []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                    {member.relationToPatient ? ` (${member.relationToPatient})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit">Book now</button>
          </form>
        ) : null}
      </section>

      <section className="card">
        <h3>Recent patient feedback</h3>
        {(data?.recentReviews || []).length === 0 ? <p className="muted">No reviews yet for this doctor.</p> : null}
        {(data?.recentReviews || []).map((review) => (
          <article className="list-item" key={review.id}>
            <div>
              <strong>{review.rating} / 5</strong>
              <p className="muted">By {review.patient?.fullName || 'Patient'}</p>
              <p className="muted">{review.comment || 'No written feedback provided.'}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function AppointmentsPage() {
  const { user } = useSession();
  const { data, error, loading } = useApiPage('/api/appointments');
  const upcoming = data?.upcomingAppointments || [];
  const past = data?.doneAppointments || [];

  return (
    <>
      <section className="journey-hero">
        <h2 className="journey-title">
          Your <span className="journey-accent">Visits</span>
        </h2>
        <p className="journey-sub">
          Stay connected with your care team. View your upcoming appointments or review your health history below.
        </p>
      </section>

      {loading ? <p className="muted">Loading appointments...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="journey-section">
        <div className="journey-section-head">
          <h3>Upcoming Visits</h3>
          <span className="journey-count-pill">{upcoming.length} Scheduled</span>
        </div>

        {upcoming.length === 0 ? <p className="journey-empty-note">No upcoming appointments.</p> : null}

        <div className="journey-appointment-stack">
          {upcoming.map((item) => (
            <article className="journey-appointment-card" key={item.id}>
              <div className="journey-appt-avatar-wrap">
                <div className="journey-appt-avatar">
                  {String(
                    user.role === 'doctor' ? item.patient?.fullName || 'P' : item.doctor?.fullName || 'D'
                  )
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                <div className="journey-appt-mode">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {item.mode === 'video' ? 'video_camera_front' : item.mode === 'audio' ? 'call' : 'chat'}
                  </span>
                </div>
              </div>

              <div className="journey-appt-main">
                <span className="journey-specialty">{item.triage?.label || 'Planned consultation'}</span>
                <h4>{user.role === 'doctor' ? item.patient?.fullName : `Dr. ${item.doctor?.fullName}`}</h4>
                <div className="journey-appt-meta-row">
                  <span>
                    <span className="material-symbols-outlined" aria-hidden="true">calendar_today</span>
                    {formatPrettyDate(item.startAt)}
                  </span>
                  <span>
                    <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                    {formatPrettyTime(item.startAt)}
                  </span>
                </div>
                <p className="journey-meta">{item.mode} consultation</p>
              </div>

              <div className="journey-appt-actions">
                {user.role === 'doctor' ? (
                  <Link className="journey-cta" to={`/calls/${item.id}`}>
                    Join Call
                  </Link>
                ) : (
                  <Link className="journey-cta" to={`/appointments/${item.id}`}>
                    Open Visit
                  </Link>
                )}
                <Link className="journey-cta subtle" to={`/appointments/${item.id}`}>
                  Details
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="journey-section">
        <div className="journey-section-head">
          <h3>Past Visits</h3>
          <Link className="journey-link-chip" to="/appointments/impact">
            Impact Dashboard
          </Link>
        </div>

        {past.length === 0 ? <p className="journey-empty-note">No completed or cancelled consultations yet.</p> : null}

        <div className="journey-history-grid">
          {past.map((item) => (
            <article className="journey-history-card" key={item.id}>
              <div className="journey-history-head">
                <div className="journey-history-avatar">
                  {String(user.role === 'doctor' ? item.patient?.fullName || 'P' : item.doctor?.fullName || 'D')
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                <div>
                  <h4>{user.role === 'doctor' ? item.patient?.fullName : `Dr. ${item.doctor?.fullName}`}</h4>
                  <p>{`Visited ${formatPrettyDate(item.startAt)}`}</p>
                </div>
              </div>

              <p className="journey-meta">Status: {item.status}</p>
              {user.role === 'patient' && item.status === 'completed' ? (
                <p className="journey-meta">{item.review ? `Your review: ${item.review.rating} / 5` : 'Review pending'}</p>
              ) : null}

              <div className="journey-history-actions">
                {item.prescription ? (
                  <a className="journey-cta subtle" href={`/api/prescriptions/${item.id}/pdf`} target="_blank" rel="noreferrer">
                    View Prescription
                  </a>
                ) : (
                  <Link className="journey-cta subtle" to={`/appointments/${item.id}`}>
                    Open Visit
                  </Link>
                )}

                {user.role === 'patient' ? (
                  <Link className="journey-cta secondary" to={item.doctor?.id ? `/book?doctorId=${item.doctor.id}` : '/book'}>
                    Re-book
                  </Link>
                ) : (
                  <Link className="journey-cta secondary" to={`/appointments/${item.id}`}>
                    Open Details
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {user.role === 'patient' ? (
        <Link className="journey-fab" to="/book" aria-label="Book appointment">
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
        </Link>
      ) : null}
    </>
  );
}

function ImpactPage() {
  const { user } = useSession();
  const { data, error, loading } = useApiPage('/api/appointments/impact');
  const metrics = data?.metrics;
  const adminInsights = metrics?.adminInsights;

  return (
    <>
      <section className="card row-between">
        <h2>Impact dashboard</h2>
        <Link className="btn subtle" to="/appointments">
          Back
        </Link>
      </section>

      {loading ? <p className="muted">Loading metrics...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {metrics ? (
        <section className="grid cards">
          <MetricCard label="Total consultations" value={metrics.total} />
          <MetricCard label="Completion rate" value={`${metrics.completionRate}%`} />
          <MetricCard label="Avg consult" value={`${metrics.avgConsultMins} min`} />
          <MetricCard label="Urgent triage" value={metrics.urgentCount} />
          <MetricCard label="Reminder due" value={metrics.reminderDueCount} />
          <MetricCard label="Follow-ups (14d)" value={metrics.followUpCount} />
        </section>
      ) : null}

      {user?.role === 'admin' && adminInsights ? (
        <>
          <section className="card">
            <h3>Admin operations panel</h3>
            <div className="grid cards">
              <MetricCard label="Unique patients reached" value={adminInsights.patientReach} />
              <MetricCard label="No-show rate" value={`${adminInsights.noShowRate}%`} />
              <MetricCard label="Urgent case rate" value={`${adminInsights.urgentRate}%`} />
              <MetricCard label="Video consults" value={adminInsights.modeCounts?.video || 0} />
              <MetricCard label="Audio consults" value={adminInsights.modeCounts?.audio || 0} />
              <MetricCard label="Text consults" value={adminInsights.modeCounts?.text || 0} />
            </div>
          </section>

          <section className="grid cards">
            <article className="card metric">
              <p className="muted">Top doctors by consultation load</p>
              {(adminInsights.topDoctors || []).length === 0 ? (
                <p className="muted">No doctor activity yet.</p>
              ) : (
                <div className="metric-stack">
                  {adminInsights.topDoctors.map((doctor) => (
                    <p key={doctor.doctorId}>
                      <strong>{doctor.doctorName}</strong>
                      {' - '}
                      {doctor.total} visits, {doctor.completionRate}% completed, {doctor.noShow} no-shows
                    </p>
                  ))}
                </div>
              )}
            </article>

            <article className="card metric">
              <p className="muted">14-day volume trend</p>
              {(adminInsights.dailySeries || []).length === 0 ? (
                <p className="muted">No data in the last 14 days.</p>
              ) : (
                <div className="metric-stack">
                  {adminInsights.dailySeries.map((row) => (
                    <p key={row.day}>
                      <strong>{row.day}</strong>
                      {' - '}
                      {row.count} consult{row.count === 1 ? '' : 's'}
                    </p>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="grid cards">
            <article className="card metric">
              <p className="muted">Operational observability</p>
              <div className="metric-stack">
                <p>
                  <strong>Readiness:</strong> {adminInsights.operational?.readiness || 'unknown'}
                </p>
                <p>
                  <strong>DB status:</strong> {adminInsights.operational?.databaseStatus || 'unknown'}
                </p>
                <p>
                  <strong>DB latency:</strong> {adminInsights.operational?.dbLatencyMs ?? 'N/A'} ms
                </p>
                <p>
                  <strong>Reminder queue:</strong> {adminInsights.operational?.reminderQueueDepth ?? 'N/A'}
                </p>
                <p>
                  <strong>Async queue:</strong> {adminInsights.operational?.asyncQueueDepth ?? 'N/A'}
                </p>
                <p>
                  <strong>Failed reminders (24h):</strong> {adminInsights.operational?.failedReminders24h ?? 'N/A'}
                </p>
              </div>
            </article>

            <article className="card metric">
              <p className="muted">Mode quality KPIs</p>
              {(adminInsights.modeKpis || []).length === 0 ? (
                <p className="muted">No mode-level KPI data yet.</p>
              ) : (
                <div className="metric-stack">
                  {adminInsights.modeKpis.map((row) => (
                    <p key={row.mode}>
                      <strong>{row.mode.toUpperCase()}</strong>
                      {' - '}
                      {row.total} visits, {row.completionRate}% completed, {row.noShowRate}% no-show
                    </p>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="card metric">
            <p className="muted">Clinical impact by region</p>
            {(adminInsights.regionKpis || []).length === 0 ? (
              <p className="muted">No region-level KPI data yet.</p>
            ) : (
              <div className="metric-stack">
                {adminInsights.regionKpis.map((row) => (
                  <p key={row.region}>
                    <strong>{row.region}</strong>
                    {' - '}
                    {row.total} visits, {row.completionRate}% completed, {row.urgentRate}% urgent
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="card metric">
      <p className="muted">{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function AppointmentDetailPage() {
  const { appointmentId } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const { data, setData, error, loading, reload } = useApiPage(`/api/appointments/${appointmentId}`);
  const [uploadMessage, setUploadMessage] = useState('');
  const [preconsultMessage, setPreconsultMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [preconsult, setPreconsult] = useState({ problemDescription: '', medicationsText: '' });
  const [reviewForm, setReviewForm] = useState({ rating: '5', comment: '' });
  const [reviewMessage, setReviewMessage] = useState('');

  useEffect(() => {
    if (data?.appointment) {
      setPreconsult({
        problemDescription: data.appointment.problemDescription || '',
        medicationsText: data.appointment.medicationsText || ''
      });
      setReviewForm({
        rating: String(data.appointment.review?.rating || 5),
        comment: data.appointment.review?.comment || ''
      });
    }
  }, [data]);

  useEffect(() => {
    if (!data?.appointment?.id) return undefined;

    const tick = async () => {
      try {
        await apiRequest('/api/users/presence/ping', { method: 'POST' });
        const presenceRes = await apiRequest(`/api/appointments/${appointmentId}/presence`);
        if (presenceRes.ok && presenceRes.data?.ok) {
          setData((prev) => ({
            ...(prev || {}),
            presence: {
              doctorOnline: presenceRes.data.doctorOnline,
              patientOnline: presenceRes.data.patientOnline,
              canStartCall: presenceRes.data.canStartCall
            }
          }));
        }
      } catch (_err) {
        // keep silent; next tick retries
      }
    };

    tick();
    const timer = setInterval(tick, user.role === 'doctor' ? 15000 : 20000);

    return () => clearInterval(timer);
  }, [appointmentId, data?.appointment?.id, setData, user.role]);

  const postAction = async (path, body) => {
    const res = await apiRequest(path, { method: 'POST', body });
    if (!res.ok) {
      return { error: res.data?.error || res.data?.message || 'Action failed.' };
    }
    if (res.data?.redirectTo) {
      navigate(res.data.redirectTo);
      return { redirected: true };
    }
    if (res.data?.appointment) {
      setData(res.data);
    }
    return { ok: true };
  };

  const submitPreconsult = async (event) => {
    event.preventDefault();
    setPreconsultMessage('');
    const result = await postAction(`/api/appointments/${appointmentId}/prep`, preconsult);
    if (result.error) setPreconsultMessage(result.error);
    if (result.ok) setPreconsultMessage('Pre-consult saved.');
  };

  const runAction = async (path, successLabel) => {
    setActionMessage('');
    const result = await postAction(path);
    if (result.error) {
      setActionMessage(result.error);
      return;
    }
    if (result.ok && successLabel) {
      setActionMessage(successLabel);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewMessage('');
    const result = await postAction(`/api/appointments/${appointmentId}/review`, {
      rating: Number(reviewForm.rating),
      comment: reviewForm.comment
    });
    if (result.error) {
      setReviewMessage(result.error);
      return;
    }
    if (result.ok) {
      setReviewMessage('Review saved. Thank you for your feedback.');
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const res = await apiRequest('/api/documents/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      setUploadMessage(res.data?.error || 'Upload failed.');
      return;
    }
    setUploadMessage('Uploaded.');
    reload();
  };

  if (loading) return <p className="muted">Loading appointment...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data?.appointment) return <p className="error">Appointment not found.</p>;

  const appointment = data.appointment;
  const patientView = user.role === 'patient' && user.id === appointment.patientId;
  const canReview =
    user.role === 'patient' && appointment.status === 'completed' && user.id === appointment.patientId;
  const personName =
    data.history?.currentPatientProfile?.name ||
    (appointment.familyMember ? appointment.familyMember.fullName : appointment.patient.fullName);
  const modeLabel =
    appointment.mode === 'video' ? 'Video Call' : appointment.mode === 'audio' ? 'Audio Call' : 'Text Consultation';
  const historyEntries = data.history?.historyAppointments || [];

  if (patientView) {
    return (
      <section className="patient-appointment-shell">
        <header className="patient-appointment-topbar">
          <div className="patient-appointment-brand">
            <Link className="patient-appointment-back" to="/appointments" aria-label="Back to appointments">
              <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            </Link>
            <strong>Digital Sanctuary</strong>
          </div>
          <div className="patient-appointment-tools">
            <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
            <span className="patient-appointment-avatar">
              {String(user.fullName || 'P').slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>

        <div className="patient-appointment-main">
          <aside className="patient-appointment-left">
            <section className="patient-appointment-summary">
              <span className="patient-appointment-status">{appointment.status}</span>
              <h1>Consultation for {personName}</h1>
              <p>{formatPrettyDate(appointment.startAt)} • {formatPrettyTime(appointment.startAt)} UTC</p>
            </section>

            <section className="patient-appointment-action-card">
              <div className="patient-appointment-mode">
                <span className="material-symbols-outlined" aria-hidden="true">
                  {appointment.mode === 'video' ? 'videocam' : appointment.mode === 'audio' ? 'call' : 'chat'}
                </span>
                <div>
                  <small>Consultation Mode</small>
                  <strong>{modeLabel}</strong>
                </div>
              </div>

              {data.presence?.canStartCall ? (
                <Link className="patient-appointment-cta" to={`/calls/${appointment.id}`}>
                  <span className="material-symbols-outlined" aria-hidden="true">videocam</span>
                  Join Call
                </Link>
              ) : (
                <button className="patient-appointment-cta locked" type="button" disabled>
                  <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                  Call locked
                </button>
              )}

              <Link className="patient-appointment-cta secondary" to={`/prescriptions/${appointment.id}`}>
                <span className="material-symbols-outlined" aria-hidden="true">description</span>
                Prescription
              </Link>

              <Link className="patient-appointment-cta secondary" to={`/ai-copilot?appointmentId=${appointment.id}`}>
                <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                AI Copilot
              </Link>

              <div className="patient-appointment-action-grid">
                <button
                  type="button"
                  className="patient-appointment-text-btn danger"
                  disabled={appointment.status !== 'booked'}
                  onClick={() => runAction(`/api/appointments/${appointment.id}/cancel`, 'Appointment cancelled.')}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">cancel</span>
                  Cancel
                </button>
                <button
                  type="button"
                  className="patient-appointment-text-btn"
                  disabled={appointment.status === 'completed' || appointment.status === 'cancelled'}
                  onClick={() => runAction(`/api/appointments/${appointment.id}/end`, 'Appointment closed.')}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                  Close
                </button>
              </div>

              {actionMessage ? <p className="muted">{actionMessage}</p> : null}
            </section>

            <section className="patient-appointment-participants">
              <h3>Participants</h3>
              <div className="patient-participant-row">
                <div className="patient-participant-main">
                  <span className="patient-participant-photo">
                    {String(appointment.doctor.fullName || 'D').slice(0, 1).toUpperCase()}
                    <span className={`patient-participant-dot ${data.presence?.doctorOnline ? 'online' : 'offline'}`} />
                  </span>
                  <div>
                    <strong>Dr. {appointment.doctor.fullName}</strong>
                    <p>{data.presence?.doctorOnline ? 'Online' : 'Offline'}</p>
                  </div>
                </div>
              </div>
              <div className="patient-participant-row">
                <div className="patient-participant-main">
                  <span className="patient-participant-photo">
                    {String(personName || 'P').slice(0, 1).toUpperCase()}
                    <span className={`patient-participant-dot ${data.presence?.patientOnline ? 'online' : 'offline'}`} />
                  </span>
                  <div>
                    <strong>{personName}</strong>
                    <p>{data.presence?.patientOnline ? 'Online' : 'Offline'}</p>
                  </div>
                </div>
              </div>
            </section>
          </aside>

          <div className="patient-appointment-right">
            {(data.error || data.message) ? (
              <section className="patient-inline-state">
                {data.error ? <p className="error">{data.error}</p> : null}
                {data.message ? <p className="success">{data.message}</p> : null}
              </section>
            ) : null}

            <section className="patient-info-card">
              <div className="patient-section-head">
                <span className="material-symbols-outlined" aria-hidden="true">history_edu</span>
                <h2>Medical History</h2>
              </div>

              <div className="patient-history-overview">
                <article>
                  <small>Chronic Conditions</small>
                  <p>{data.history?.currentPatientProfile?.chronicConditions || 'N/A'}</p>
                </article>
                <article>
                  <small>Basic Health Info</small>
                  <p>{data.history?.currentPatientProfile?.basicHealthInfo || 'N/A'}</p>
                </article>
              </div>

              <div className="patient-history-grid">
                {(data.history?.historyAppointments || []).slice(0, 4).map((entry) => (
                  <article key={entry.id}>
                    <div className="patient-history-row-head">
                      <strong>{formatPrettyDate(entry.startAt)}</strong>
                      <span>{formatPrettyTime(entry.startAt)} UTC</span>
                    </div>
                    <p>{entry.prescription?.diagnosis || 'No prescription'}</p>
                  </article>
                ))}
                {(data.history?.historyAppointments || []).length === 0 ? (
                  <p className="muted">No previous consultations.</p>
                ) : null}
              </div>
            </section>

            <section className="patient-info-card soft">
              <div className="patient-section-head">
                <span className="material-symbols-outlined" aria-hidden="true">edit_note</span>
                <h2>Pre-consultation Notes</h2>
              </div>

              {appointment.status === 'booked' ? (
                <form className="patient-form-stack" onSubmit={submitPreconsult}>
                  <label>
                    Symptoms and concerns
                    <textarea
                      value={preconsult.problemDescription}
                      onChange={(e) => setPreconsult((prev) => ({ ...prev, problemDescription: e.target.value }))}
                      placeholder={`Describe how ${personName} is feeling...`}
                    />
                  </label>
                  <label>
                    Current medicines
                    <textarea
                      value={preconsult.medicationsText}
                      onChange={(e) => setPreconsult((prev) => ({ ...prev, medicationsText: e.target.value }))}
                      placeholder="List any medications currently being taken..."
                    />
                  </label>
                  <button className="patient-form-submit" type="submit">Save pre-consult</button>
                  {preconsultMessage ? <p className="muted">{preconsultMessage}</p> : null}
                </form>
              ) : (
                <div className="panel-soft">
                  <p>{appointment.problemDescription || 'No symptoms submitted.'}</p>
                  <p>{appointment.medicationsText || 'No medicines submitted.'}</p>
                </div>
              )}
            </section>

            <section className="patient-info-card">
              <div className="patient-section-head">
                <span className="material-symbols-outlined" aria-hidden="true">upload_file</span>
                <h2>Medical Documents</h2>
              </div>

              {appointment.status === 'booked' ? (
                <form className="patient-upload-grid" onSubmit={handleUpload}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <label>
                    Upload for
                    <select name="uploadFor" defaultValue={appointment.familyMemberId || 'user'}>
                      <option value="user">{appointment.patient.fullName}</option>
                      {(data.familyMembers || []).map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Select File
                    <input type="file" name="file" required />
                  </label>
                  <button className="patient-form-submit" type="submit">
                    <span className="material-symbols-outlined" aria-hidden="true">cloud_upload</span>
                    Upload
                  </button>
                </form>
              ) : null}

              {uploadMessage ? <p className="muted">{uploadMessage}</p> : null}

              <div className="patient-doc-list">
                {(appointment.documents || []).length === 0 ? <p className="muted">No documents attached.</p> : null}
                {(appointment.documents || []).map((doc) => (
                  <article className="patient-doc-item" key={doc.id}>
                    <div>
                      <strong>{doc.fileName}</strong>
                      <p>{Math.round(doc.sizeBytes / 1024)} KB</p>
                    </div>
                    <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  </article>
                ))}
              </div>
            </section>

            {canReview ? (
              <section className="patient-info-card">
                <div className="patient-section-head">
                  <span className="material-symbols-outlined" aria-hidden="true">star</span>
                  <h2>Rate your doctor</h2>
                </div>
                <form className="patient-form-stack" onSubmit={submitReview}>
                  <label>
                    Rating
                    <select value={reviewForm.rating} onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: e.target.value }))}>
                      <option value="5">5 - Excellent</option>
                      <option value="4">4 - Very good</option>
                      <option value="3">3 - Good</option>
                      <option value="2">2 - Fair</option>
                      <option value="1">1 - Poor</option>
                    </select>
                  </label>
                  <label>
                    Comment
                    <textarea
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                      placeholder="Share your experience with this consultation"
                    />
                  </label>
                  <button className="patient-form-submit" type="submit">Save review</button>
                </form>
                {reviewMessage ? <p className="muted">{reviewMessage}</p> : null}
              </section>
            ) : null}
          </div>
        </div>

        <nav className="patient-appointment-mobile-nav" aria-label="Patient quick navigation">
          <Link to="/dashboard">
            <span className="material-symbols-outlined" aria-hidden="true">home_health</span>
            <span>Home</span>
          </Link>
          <Link className="active" to="/appointments">
            <span className="material-symbols-outlined" aria-hidden="true">calendar_today</span>
            <span>Visits</span>
          </Link>
          <Link to="/patients/workspace">
            <span className="material-symbols-outlined" aria-hidden="true">monitor_heart</span>
            <span>Health</span>
          </Link>
        </nav>
      </section>
    );
  }

  return (
    <section className="doctor-appointment-shell">
      <header className="doctor-appointment-topbar">
        <div className="doctor-appointment-brand">Digital Sanctuary</div>
        <nav className="doctor-appointment-nav" aria-label="Consultation navigation">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/appointments" className="active">Consultations</Link>
        </nav>
        <div className="doctor-appointment-top-actions">
          <button type="button" className="doctor-appointment-icon-btn" aria-label="Notifications">
            <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
          </button>
          <button type="button" className="doctor-appointment-icon-btn" aria-label="Settings">
            <span className="material-symbols-outlined" aria-hidden="true">settings</span>
          </button>
          <span className="doctor-appointment-avatar">{String(user.fullName || 'D').slice(0, 1).toUpperCase()}</span>
        </div>
      </header>

      <div className="doctor-appointment-content">
        <aside className="doctor-appointment-sidebar">
          <section className="doctor-appointment-patient-card">
            <div className="doctor-appointment-patient-head">
              <span className="doctor-appointment-patient-avatar">{String(personName || 'P').slice(0, 1).toUpperCase()}</span>
              <div>
                <h3>{personName}</h3>
                <p>ID: {String(appointment.id).slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            {data.presence?.canStartCall ? (
              <Link className="doctor-appointment-start-btn" to={`/calls/${appointment.id}`}>
                <span className="material-symbols-outlined" aria-hidden="true">video_call</span>
                Start Consultation
              </Link>
            ) : (
              <button className="doctor-appointment-start-btn locked" type="button" disabled>
                <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                Call Locked
              </button>
            )}
          </section>

          <nav className="doctor-appointment-side-nav" aria-label="Detail sections">
            <a href="#overview" className="active">
              <span className="material-symbols-outlined" aria-hidden="true">clinical_notes</span>
              Overview
            </a>
            <a href="#history">
              <span className="material-symbols-outlined" aria-hidden="true">history</span>
              Medical History
            </a>
            <a href="#documents">
              <span className="material-symbols-outlined" aria-hidden="true">description</span>
              Documents
            </a>
          </nav>
        </aside>

        <div className="doctor-appointment-main">
          <header className="doctor-appointment-hero" id="overview">
            <div>
              <span className="doctor-appointment-kicker">Ongoing Journey</span>
              <h1>Consultation with {personName}</h1>
              <div className="doctor-appointment-meta-chips">
                <span>
                  <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                  {utcDateTime(appointment.startAt)}
                </span>
                <span className="status">
                  <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                  Status: {appointment.status}
                </span>
                <span>
                  <span className="material-symbols-outlined" aria-hidden="true">videocam</span>
                  Mode: {modeLabel}
                </span>
              </div>
            </div>

            <div className="doctor-appointment-actions">
              {data.presence?.canStartCall ? (
                <Link className="doctor-appointment-action-main" to={`/calls/${appointment.id}`}>
                  <span className="material-symbols-outlined" aria-hidden="true">video_call</span>
                  Join Call
                </Link>
              ) : (
                <button className="doctor-appointment-action-main locked" type="button" disabled>
                  <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                  Call Locked
                </button>
              )}

              <div className="doctor-appointment-action-grid">
                <Link className="doctor-appointment-sub-btn" to={`/prescriptions/${appointment.id}`}>
                  Prescription
                </Link>
                <Link className="doctor-appointment-sub-btn" to={`/ai-copilot?appointmentId=${appointment.id}`}>
                  AI Copilot
                </Link>
                <button
                  type="button"
                  className="doctor-appointment-sub-btn danger"
                  disabled={appointment.status !== 'booked'}
                  onClick={() => runAction(`/api/appointments/${appointment.id}/cancel`, 'Appointment cancelled.')}
                >
                  Cancel
                </button>
              </div>

              {appointment.status !== 'completed' && appointment.status !== 'cancelled' ? (
                <button
                  type="button"
                  className="doctor-appointment-sub-btn subtle"
                  onClick={() => runAction(`/api/appointments/${appointment.id}/end`, 'Appointment closed.')}
                >
                  Close Appointment
                </button>
              ) : null}
            </div>
          </header>

          {(data.error || data.message || actionMessage) ? (
            <section className="doctor-appointment-flash">
              {data.error ? <p className="error">{data.error}</p> : null}
              {data.message ? <p className="success">{data.message}</p> : null}
              {actionMessage ? <p className="muted">{actionMessage}</p> : null}
            </section>
          ) : null}

          <div className="doctor-appointment-grid">
            <div className="doctor-appointment-left-col">
              <section className="doctor-appointment-participants">
                <h2>
                  <span className="material-symbols-outlined" aria-hidden="true">groups</span>
                  Participants
                </h2>

                <article className="doctor-appointment-participant-row">
                  <span className="avatar">{String(appointment.doctor.fullName || 'D').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>Dr. {appointment.doctor.fullName}</strong>
                    <p>{data.presence?.doctorOnline ? 'Online' : 'Offline'}</p>
                  </div>
                </article>

                <article className="doctor-appointment-participant-row">
                  <span className="avatar">{String(personName || 'P').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{personName}</strong>
                    <p>{data.presence?.patientOnline ? 'Online' : 'Offline'}</p>
                  </div>
                </article>
              </section>

              <section className="doctor-appointment-prep">
                <h2>Pre-consultation Notes</h2>
                <article>
                  <small>Patient Symptoms</small>
                  <p>{appointment.problemDescription || 'No symptoms submitted.'}</p>
                </article>
                <article>
                  <small>Current Medicines</small>
                  <p>{appointment.medicationsText || 'No medicines submitted.'}</p>
                </article>
                {preconsultMessage ? <p className="muted">{preconsultMessage}</p> : null}
              </section>

              <section className="doctor-appointment-docs" id="documents">
                <h2>Documents</h2>
                {(appointment.documents || []).length === 0 ? <p className="muted">No documents attached.</p> : null}
                {(appointment.documents || []).map((doc) => (
                  <article key={doc.id} className="doctor-appointment-doc-row">
                    <div>
                      <strong>{doc.fileName}</strong>
                      <p>{Math.round(doc.sizeBytes / 1024)} KB</p>
                    </div>
                    <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  </article>
                ))}
              </section>
            </div>

            <section className="doctor-appointment-history" id="history">
              <div className="doctor-appointment-history-head">
                <h2>Medical History</h2>
                <span>{historyEntries.length} Records Found</span>
              </div>

              <div className="doctor-appointment-history-list">
                {historyEntries.length === 0 ? <p className="muted">No previous consultations.</p> : null}
                {historyEntries.map((entry) => {
                  const diagnosis = entry.prescription?.diagnosis || 'No prescription issued.';
                  const tone = /critical|severe|urgent|emergency/i.test(diagnosis)
                    ? 'critical'
                    : /fever|infection|pain|symptom/i.test(diagnosis)
                      ? 'alert'
                      : 'default';

                  return (
                    <article className={`doctor-history-item ${tone}`} key={entry.id}>
                      <div className="icon">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {tone === 'critical' ? 'emergency' : tone === 'alert' ? 'thermometer' : 'clinical_notes'}
                        </span>
                      </div>
                      <div className="content">
                        <div className="row">
                          <strong>{entry.prescription?.diagnosis || 'Consultation recap'}</strong>
                          <time>{utcDateTime(entry.startAt)}</time>
                        </div>
                        <p>{diagnosis}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function CallPage() {
  const { appointmentId } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const { data, error, loading } = useApiPage(`/api/calls/${appointmentId}`);
  const callScriptRef = useRef(null);

  useEffect(() => {
    if (!data?.callConfigEncoded) return undefined;

    const socketScript = document.createElement('script');
    socketScript.src = '/socket.io/socket.io.js';
    socketScript.async = false;

    const runtimeScript = document.createElement('script');
    runtimeScript.src = `/public/js/call.js?v=${Date.now()}`;
    runtimeScript.async = false;

    socketScript.onload = () => {
      document.body.appendChild(runtimeScript);
      callScriptRef.current = runtimeScript;
    };

    document.body.appendChild(socketScript);

    return () => {
      if (socketScript.parentNode) socketScript.parentNode.removeChild(socketScript);
      if (runtimeScript.parentNode) runtimeScript.parentNode.removeChild(runtimeScript);
    };
  }, [data?.callConfigEncoded]);

  const endCall = async () => {
    const res = await apiRequest(`/api/calls/${appointmentId}/end`, { method: 'POST' });
    if (res.data?.redirectTo) {
      navigate(res.data.redirectTo);
      return;
    }
    navigate(`/appointments/${appointmentId}`);
  };

  if (loading) return <p className="muted">Preparing your consultation room...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data?.appointment) return <p className="error">Call not available.</p>;

  const appointment = data.appointment;
  const doctorName = appointment.doctor?.fullName ? `Dr. ${appointment.doctor.fullName}` : 'Doctor';
  const patientName = appointment.familyMember?.fullName || appointment.patient?.fullName || 'Patient';
  const modeText = appointment.mode === 'video' ? 'Video' : appointment.mode === 'audio' ? 'Audio' : 'Text';

  return (
    <section className="call-sanctuary-shell">
      <header className="call-sanctuary-top">
        <div className="call-top-left">
          <strong>Digital Sanctuary</strong>
          <div className="call-top-meta">
            <span>Live consultation in progress</span>
            <small>ID: {appointment.id}</small>
          </div>
        </div>

        <div className="call-top-right">
          <span className="call-mode-chip">
            <span className="material-symbols-outlined" aria-hidden="true">videocam</span>
            Mode: {modeText}
          </span>
          <span id="status" className="call-status-chip">idle</span>
        </div>
      </header>

      <main className="call-sanctuary-main">
        <div className="call-safety-tip" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">network_check</span>
          <p>If your network drops, stay on this screen. The session will reconnect automatically when possible.</p>
        </div>

        <section className="call-video-stage">
          <video id="remoteVideo" autoPlay playsInline />

          <div className="call-identity-badge">
            <span className={`dot ${(data.presence?.doctorOnline || data.presence?.patientOnline) ? 'online' : ''}`} />
            <span>{user.role === 'doctor' ? patientName : doctorName}</span>
          </div>

          <div className="call-local-wrap">
            <video id="localVideo" autoPlay muted playsInline className="local-preview" />
            <small>You</small>
          </div>
        </section>
      </main>

      <aside className="call-sidebar" aria-label="Visit details and chat">
        <div className="call-sidebar-head">
          <h2>Visit Details</h2>
          <p>Secure connection</p>
        </div>

        <div className="call-chat-note">
          Use this panel if voice is unclear due to low network quality.
        </div>

        <div className="call-chat-tools" aria-label="Chat translation controls">
          <label htmlFor="chatLanguage">Chat translation language</label>
          <div className="call-chat-tools-row">
            <select id="chatLanguage" defaultValue={user.language || 'English'}>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Bengali">Bengali</option>
              <option value="Tamil">Tamil</option>
              <option value="Telugu">Telugu</option>
              <option value="Marathi">Marathi</option>
              <option value="Gujarati">Gujarati</option>
              <option value="Kannada">Kannada</option>
              <option value="Malayalam">Malayalam</option>
              <option value="Urdu">Urdu</option>
            </select>
            <button id="btnTranslateToggle" type="button" className="call-control-btn compact">
              <span className="material-symbols-outlined" aria-hidden="true">translate</span>
              <span data-label>Translate: Off</span>
            </button>
          </div>
          <p className="muted">When enabled, incoming and outgoing chat messages are translated to your selected language.</p>
          <Link className="call-ai-link" to={`/ai-copilot?appointmentId=${appointment.id}`}>
            Open full AI Copilot workspace
          </Link>
        </div>

        <div id="chatLog" className="chat-log call-chat-log" />

        <form id="chatForm" className="call-chat-form">
          <input id="chatInput" placeholder="Type a message..." />
          <button type="submit" aria-label="Send chat message">
            <span className="material-symbols-outlined" aria-hidden="true">send</span>
          </button>
        </form>
      </aside>

      <nav className="call-controls" aria-label="Call controls">
        <div className="call-controls-group primary">
          <button id="btnMute" className="call-control-btn" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">mic</span>
            <span data-label>Mute</span>
          </button>
          <button id="btnVideo" className="call-control-btn active" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">videocam</span>
            <span>Video</span>
          </button>
          <button id="btnAudio" className="call-control-btn" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">volume_up</span>
            <span>Audio</span>
          </button>
          <button id="btnText" className="call-control-btn" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">chat_bubble</span>
            <span>Text</span>
          </button>
          <button id="btnDataQuality" className="call-control-btn" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">network_check</span>
            <span data-label>Quality: Auto</span>
          </button>
          <button id="btnCamera" className="call-control-btn" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">photo_camera</span>
            <span data-label>Camera</span>
          </button>
        </div>

        <button className="call-end-btn" type="button" onClick={endCall}>
          <span className="material-symbols-outlined" aria-hidden="true">call_end</span>
          End Call
        </button>
      </nav>

      <div id="callRuntimeConfig" data-call-config={data.callConfigEncoded} />
    </section>
  );
}

function PrescriptionPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data, setData, error, loading } = useApiPage(`/api/prescriptions/${appointmentId}`);
  const [message, setMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('Show to Pharmacist');
  const [rows, setRows] = useState([{ medicationName: '', dosage: '', frequency: '', duration: '' }]);
  const [form, setForm] = useState({
    diagnosis: '',
    instructions: '',
    followUpAt: '',
    pharmacyName: '',
    pharmacyContact: '',
    notes: ''
  });

  useEffect(() => {
    const prescription = data?.appointment?.prescription;
    if (!prescription) return;

    const rowItems = Array.isArray(prescription.items) && prescription.items.length > 0
      ? prescription.items.map((item) => ({
          medicationName: item.name || '',
          dosage: item.dosage || '',
          frequency: item.frequency || '',
          duration: item.duration || ''
        }))
      : [{ medicationName: '', dosage: '', frequency: '', duration: '' }];

    setRows(rowItems);
    setForm({
      diagnosis: prescription.diagnosis || '',
      instructions: prescription.instructions || '',
      followUpAt: prescription.followUpAt ? new Date(prescription.followUpAt).toISOString().slice(0, 10) : '',
      pharmacyName: data.handoff?.pharmacyName || '',
      pharmacyContact: data.handoff?.pharmacyContact || '',
      notes: prescription.notes || ''
    });
  }, [data]);

  const isDoctorOwner =
    user.role === 'doctor' && data?.appointment && user.id === data.appointment.doctorId;

  const savePrescription = async (event) => {
    event.preventDefault();
    setMessage('');

    const payload = {
      ...form,
      medicationName: rows.map((row) => row.medicationName),
      dosage: rows.map((row) => row.dosage),
      frequency: rows.map((row) => row.frequency),
      duration: rows.map((row) => row.duration)
    };

    const res = await apiRequest(`/api/prescriptions/${appointmentId}`, {
      method: 'POST',
      body: payload
    });

    if (!res.ok) {
      setMessage(res.data?.error || res.data?.message || 'Unable to save prescription.');
      return;
    }

    if (res.data?.appointment) {
      setData(res.data);
    }

    navigate(`/appointments/${appointmentId}`, { replace: true });
  };

  const copyHandoffCode = async () => {
    try {
      await navigator.clipboard.writeText(data?.handoffCode || '');
      setCopyMessage('Code copied');
    } catch (_err) {
      setCopyMessage('Copy unavailable');
    }

    window.setTimeout(() => setCopyMessage('Show to Pharmacist'), 1800);
  };

  if (loading) return <p className="muted">Loading prescription...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data?.appointment) return <p className="error">Prescription not found.</p>;

  const appointment = data.appointment;
  const prescription = appointment.prescription;
  const patientName = appointment.familyMember
    ? `${appointment.familyMember.fullName} (family)`
    : appointment.patient.fullName;
  const doctorName = `Dr. ${appointment.doctor.fullName}`;
  const instructionsText = prescription?.instructions || 'No specific dietary instructions provided for this diagnosis.';

  if (user.role === 'patient') {
    if (!prescription) {
      return (
        <section className="patient-prescription-shell">
          <header className="patient-prescription-topbar">
            <div className="patient-prescription-brand">Digital Sanctuary</div>
            <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
          </header>

          <main className="patient-prescription-main waiting">
            <h1>Prescription Pending</h1>
            <p>Your doctor has not issued a prescription yet for this appointment.</p>
            <Link className="patient-prescription-primary-cta" to={`/appointments/${appointmentId}`}>
              Back to Appointment Details
            </Link>
          </main>
        </section>
      );
    }

    return (
      <section className="patient-prescription-shell">
        <header className="patient-prescription-topbar">
          <div className="patient-prescription-brand">Digital Sanctuary</div>
          <button className="patient-prescription-icon" type="button" aria-label="Profile">
            <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
          </button>
        </header>

        <main className="patient-prescription-main">
          <header className="patient-prescription-hero">
            <h1>Prescription Ready.</h1>
            <p>
              Your consultation with {doctorName} is complete. Please share the code below with your pharmacist.
            </p>
          </header>

          <section className="patient-prescription-handoff">
            <span className="patient-prescription-label">Pharmacist Handoff Code</span>
            <p className="patient-prescription-code">{data.handoffCode}</p>
            <button type="button" onClick={copyHandoffCode}>
              <span className="material-symbols-outlined" aria-hidden="true">qr_code_2</span>
              {copyMessage}
            </button>
          </section>

          <section className="patient-prescription-summary">
            <h2>
              <span className="material-symbols-outlined" aria-hidden="true">assignment</span>
              Appointment Summary
            </h2>
            <div className="patient-prescription-summary-grid">
              <article>
                <small>Doctor</small>
                <p>{doctorName}</p>
              </article>
              <article>
                <small>Patient</small>
                <p>{patientName}</p>
              </article>
              <article className="wide">
                <small>Session ID</small>
                <p className="mono">{appointment.id}</p>
              </article>
            </div>
          </section>

          <section className="patient-prescription-diagnosis">
            <small>Primary Diagnosis</small>
            <div>
              <span className="material-symbols-outlined" aria-hidden="true">healing</span>
              <h2>{prescription.diagnosis}</h2>
            </div>
          </section>

          <section className="patient-prescription-medications">
            <h2>Prescribed Medications</h2>

            {(prescription.items || []).map((item, idx) => (
              <article key={`${item.name || 'Medication'}-${idx}`}>
                <div className="icon">
                  <span className="material-symbols-outlined" aria-hidden="true">medication</span>
                </div>

                <div className="content">
                  <h3>{item.name || 'Medication'}</h3>
                  <p>{item.dosage || 'Dosage not specified'}</p>

                  <div className="meta-grid">
                    <div>
                      <small>Frequency</small>
                      <strong>{item.frequency || 'N/A'}</strong>
                    </div>
                    <div>
                      <small>Duration</small>
                      <strong>{item.duration || 'N/A'}</strong>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {(prescription.items || []).length === 0 ? (
              <p className="muted">No medications listed.</p>
            ) : null}
          </section>

          <section className="patient-prescription-instructions">
            <h2>
              <span className="material-symbols-outlined" aria-hidden="true">info</span>
              Doctor's Instructions
            </h2>
            <p>{instructionsText}</p>
          </section>

          <div className="patient-prescription-actions">
            <a href={`/api/prescriptions/${appointmentId}/pdf`} target="_blank" rel="noreferrer">
              <span className="material-symbols-outlined" aria-hidden="true">download</span>
              Download PDF Prescription
            </a>
            <Link to={`/ai-copilot?appointmentId=${appointmentId}`}>
              <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
              Explain with AI Copilot
            </Link>
            <small>Valid for 30 days from date of issue.</small>
          </div>
        </main>

        <nav className="patient-prescription-bottom-nav" aria-label="Patient quick navigation">
          <Link to="/dashboard">
            <span className="material-symbols-outlined" aria-hidden="true">home_health</span>
            <span>Home</span>
          </Link>
          <Link className="active" to="/appointments">
            <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
            <span>Visits</span>
          </Link>
          <Link to="/appointments">
            <span className="material-symbols-outlined" aria-hidden="true">chat_bubble</span>
            <span>Messages</span>
          </Link>
          <Link to="/patients/workspace">
            <span className="material-symbols-outlined" aria-hidden="true">contact_support</span>
            <span>Help</span>
          </Link>
        </nav>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h2>Prescription</h2>
        {message ? <p className={message.toLowerCase().includes('unable') ? 'error' : 'success'}>{message}</p> : null}
        <p>
          <strong>Appointment:</strong> {appointment.id}
        </p>
        <p>
          <strong>Handoff code:</strong> <span className="pill">{data.handoffCode}</span>
        </p>
        <p>
          <strong>Doctor:</strong> {appointment.doctor.fullName} | <strong>Patient:</strong> {patientName}
        </p>
        <a className="btn subtle" href={`/api/prescriptions/${appointmentId}/pdf`} target="_blank" rel="noreferrer">
          Download PDF
        </a>
      </section>

      {prescription ? (
        <section className="card">
          <h3>Current prescription</h3>
          <p>
            <strong>Diagnosis:</strong> {prescription.diagnosis}
          </p>
          {(prescription.items || []).map((item, idx) => (
            <article className="list-item" key={`${item.name}-${idx}`}>
              <div>
                <strong>
                  {idx + 1}. {item.name || 'Medication'}
                </strong>
                <p className="muted">
                  {item.dosage || 'N/A'} | {item.frequency || 'N/A'} | {item.duration || 'N/A'}
                </p>
              </div>
            </article>
          ))}
          <p>
            <strong>Instructions:</strong> {prescription.instructions || 'N/A'}
          </p>
        </section>
      ) : null}

      {isDoctorOwner ? (
        <section className="card">
          <h3>{prescription ? 'Edit' : 'Create'} prescription</h3>
          <form className="stack" onSubmit={savePrescription}>
            <label>
              Diagnosis
              <input
                value={form.diagnosis}
                onChange={(e) => setForm((prev) => ({ ...prev, diagnosis: e.target.value }))}
                required
              />
            </label>

            <div className="stack">
              <div className="row-between">
                <h4>Medications</h4>
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    setRows((prev) => [...prev, { medicationName: '', dosage: '', frequency: '', duration: '' }])
                  }
                >
                  Add medicine
                </button>
              </div>

              {rows.map((row, idx) => (
                <div className="grid four" key={`row-${idx}`}>
                  <label>
                    Name
                    <input
                      value={row.medicationName}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, medicationName: e.target.value } : entry
                          )
                        )
                      }
                      required
                    />
                  </label>
                  <label>
                    Dosage
                    <input
                      value={row.dosage}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((entry, entryIdx) => (entryIdx === idx ? { ...entry, dosage: e.target.value } : entry))
                        )
                      }
                    />
                  </label>
                  <label>
                    Frequency
                    <input
                      value={row.frequency}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, frequency: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    Duration
                    <input
                      value={row.duration}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, duration: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>

            <label>
              Instructions
              <textarea
                value={form.instructions}
                onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))}
              />
            </label>
            <label>
              Follow-up date
              <input
                type="date"
                value={form.followUpAt}
                onChange={(e) => setForm((prev) => ({ ...prev, followUpAt: e.target.value }))}
              />
            </label>
            <label>
              Preferred pharmacy
              <input
                value={form.pharmacyName}
                onChange={(e) => setForm((prev) => ({ ...prev, pharmacyName: e.target.value }))}
              />
            </label>
            <label>
              Pharmacy contact
              <input
                value={form.pharmacyContact}
                onChange={(e) => setForm((prev) => ({ ...prev, pharmacyContact: e.target.value }))}
              />
            </label>
            <label>
              Notes
              <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </label>
            <button type="submit">Save prescription</button>
          </form>
        </section>
      ) : null}
    </>
  );
}

function AICopilotPage() {
  const { user } = useSession();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const prefillAppointmentId = searchParams.get('appointmentId') || '';
  const prefillDocumentId = searchParams.get('documentId') || '';

  const [contextLoading, setContextLoading] = useState(true);
  const [refreshingContext, setRefreshingContext] = useState(false);
  const [showBackendDetails, setShowBackendDetails] = useState(false);
  const [contextError, setContextError] = useState('');
  const [contextData, setContextData] = useState({
    ollama: { configured: false, model: 'fallback', baseUrl: 'http://127.0.0.1:11434' },
    appointments: [],
    documents: [],
    delegatedPatients: []
  });

  const [appointmentId, setAppointmentId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [patientId, setPatientId] = useState('');

  const [draftFocus, setDraftFocus] = useState('');
  const [summaryAudience, setSummaryAudience] = useState('patient');
  const [summaryLanguage, setSummaryLanguage] = useState(user.language || 'English');
  const [medLanguage, setMedLanguage] = useState(user.language || 'English');
  const [medReadingLevel, setMedReadingLevel] = useState('easy');
  const [triageSubject, setTriageSubject] = useState('');
  const [triageSymptoms, setTriageSymptoms] = useState('');
  const [triagePriority, setTriagePriority] = useState('medium');
  const [triageLanguage, setTriageLanguage] = useState(user.language || 'English');
  const [reminderTone, setReminderTone] = useState('warm');
  const [reminderChannel, setReminderChannel] = useState('sms');
  const [reminderLanguage, setReminderLanguage] = useState(user.language || 'English');
  const [documentQuestion, setDocumentQuestion] = useState('');
  const [documentLanguage, setDocumentLanguage] = useState(user.language || 'English');
  const [guidanceGoal, setGuidanceGoal] = useState('Daily support plan for medication and symptom monitoring.');
  const [guidanceLanguage, setGuidanceLanguage] = useState(user.language || 'English');
  const [translationText, setTranslationText] = useState('');
  const [translationSourceLanguage, setTranslationSourceLanguage] = useState('auto');
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState(user.language || 'English');

  const [busyMap, setBusyMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const [resultMap, setResultMap] = useState({});
  const [offlineDrafts, setOfflineDrafts] = useState(() => {
    try {
      const raw = window.localStorage.getItem(AI_OFFLINE_DRAFTS_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  });

  const appointments = contextData.appointments || [];
  const documents = contextData.documents || [];
  const delegatedPatients = contextData.delegatedPatients || [];
  const selectedAppointment = useMemo(
    () => appointments.find((row) => row.id === appointmentId) || null,
    [appointments, appointmentId]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_OFFLINE_DRAFTS_KEY, JSON.stringify(offlineDrafts.slice(0, 80)));
    } catch (_err) {
      // Ignore local storage persistence errors.
    }
  }, [offlineDrafts]);

  const loadContext = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshingContext(true);
    } else {
      setContextLoading(true);
    }
    setContextError('');

    try {
      const res = await apiRequest('/api/ai/context');
      if (!res.ok) {
        setContextError(res.data?.error || 'Unable to load AI context.');
        return;
      }

      setContextData({
        ollama: res.data?.ollama || { configured: false, model: 'fallback', baseUrl: 'http://127.0.0.1:11434' },
        appointments: res.data?.appointments || [],
        documents: res.data?.documents || [],
        delegatedPatients: res.data?.delegatedPatients || []
      });
    } catch (_err) {
      setContextError('Unable to load AI context due to network issues.');
    } finally {
      setContextLoading(false);
      setRefreshingContext(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!appointments.length) return;
    setAppointmentId((prev) => prev || prefillAppointmentId || appointments[0].id || '');
  }, [appointments, prefillAppointmentId]);

  useEffect(() => {
    if (!documents.length) return;
    setDocumentId((prev) => prev || prefillDocumentId || documents[0].id || '');
  }, [documents, prefillDocumentId]);

  useEffect(() => {
    if (!delegatedPatients.length) return;
    setPatientId((prev) => prev || delegatedPatients[0].id || '');
  }, [delegatedPatients]);

  useEffect(() => {
    const preferredLanguage = selectedAppointment?.patient?.language || selectedAppointment?.doctor?.language || user.language || 'English';
    if (!selectedAppointment) return;
    setSummaryLanguage(preferredLanguage);
    setReminderLanguage(preferredLanguage);
  }, [selectedAppointment, user.language]);

  const queueOfflineDraft = useCallback((key, path, body) => {
    const draft = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      key,
      path,
      body,
      createdAt: new Date().toISOString()
    };
    setOfflineDrafts((prev) => [draft, ...prev].slice(0, 80));
  }, []);

  const retryOfflineDraft = useCallback(async (draft) => {
    const res = await apiRequest(draft.path, {
      method: 'POST',
      body: draft.body
    });

    if (!res.ok) {
      throw new Error(res.data?.error || 'Retry failed');
    }

    setResultMap((prev) => ({ ...prev, [draft.key]: res.data }));
  }, []);

  const retryAllOfflineDrafts = useCallback(async () => {
    if (!offlineDrafts.length) return;
    setBusyMap((prev) => ({ ...prev, offlineRetry: true }));
    const remaining = [];

    for (const draft of offlineDrafts) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await retryOfflineDraft(draft);
      } catch (_err) {
        remaining.push(draft);
      }
    }

    setOfflineDrafts(remaining);
    setBusyMap((prev) => ({ ...prev, offlineRetry: false }));
  }, [offlineDrafts, retryOfflineDraft]);

  const runFeature = async (key, path, body) => {
    setBusyMap((prev) => ({ ...prev, [key]: true }));
    setErrorMap((prev) => ({ ...prev, [key]: '' }));

    try {
      const res = await apiRequest(path, {
        method: 'POST',
        body
      });

      if (!res.ok) {
        setErrorMap((prev) => ({ ...prev, [key]: res.data?.error || 'Unable to complete this AI action.' }));
        return;
      }

      setResultMap((prev) => ({ ...prev, [key]: res.data }));
    } catch (_err) {
      queueOfflineDraft(key, path, body);
      setErrorMap((prev) => ({ ...prev, [key]: 'Network issue detected. Draft saved offline for retry.' }));
    } finally {
      setBusyMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const renderResult = (key) => {
    const data = resultMap[key];
    if (!data) return null;

    return (
      <div className="ai-result-box">
        <div className="ai-result-meta">
          <span className="pill">Model: {data.model || 'fallback'}</span>
          <span className="pill">Fallback: {data.fallbackUsed ? 'yes' : 'no'}</span>
          <span className="pill">Review: {data.requiresReview ? 'required' : 'optional'}</span>
        </div>
        <pre>{JSON.stringify(data.result || {}, null, 2)}</pre>
      </div>
    );
  };

  if (contextLoading) return <p className="muted">Preparing AI Copilot workspace...</p>;

  return (
    <section className="ai-copilot-shell">
      <header className="ai-copilot-hero">
        <p className="kicker">Secure AI Layer</p>
        <h2>Ollama AI Copilot Workspace</h2>
        <p>
          Every output is a draft. Human review stays mandatory for clinical decisions, reminders, and record updates.
        </p>
        <div className="ai-copilot-hero-meta">
          <span className="pill">Ollama: {contextData.ollama?.configured ? 'connected' : 'fallback mode'}</span>
          <span className="pill">Model: {contextData.ollama?.model || 'fallback'}</span>
          <span className="pill">Endpoint: {contextData.ollama?.baseUrl || 'N/A'}</span>
          <button type="button" className="compass-toggle-btn" onClick={() => setShowBackendDetails((prev) => !prev)}>
            {showBackendDetails ? 'Hide backend status' : 'Show backend status'}
          </button>
          <button type="button" className="compass-toggle-btn" onClick={() => loadContext({ silent: true })} disabled={refreshingContext}>
            {refreshingContext ? 'Refreshing...' : 'Refresh backend status'}
          </button>
        </div>

        {showBackendDetails ? (
          <div className="ai-result-box">
            <div className="ai-result-meta">
              <span className="pill">Backend: Ollama</span>
              <span className="pill">State: {contextData.ollama?.configured ? 'configured' : 'fallback active'}</span>
            </div>
            <p className="muted">Model: {contextData.ollama?.model || 'fallback'}</p>
            <p className="muted">Endpoint: {contextData.ollama?.baseUrl || 'N/A'}</p>
            {!contextData.ollama?.configured ? (
              <p className="error">Ollama is not configured. Set OLLAMA_BASE_URL and OLLAMA_MODEL in your environment.</p>
            ) : (
              <p className="success">Ollama configuration detected. AI features will use the configured local model.</p>
            )}
          </div>
        ) : null}
      </header>

      {contextError ? <p className="error">{contextError}</p> : null}

      <article className="compass-card">
        <h3>Offline draft queue</h3>
        <p className="muted">
          Failed AI requests are saved locally so low-connectivity users can retry safely.
        </p>
        <div className="row-inline">
          <span className="pill">Queued drafts: {offlineDrafts.length}</span>
          <button type="button" className="compass-action-btn subtle" onClick={retryAllOfflineDrafts} disabled={!offlineDrafts.length || busyMap.offlineRetry}>
            {busyMap.offlineRetry ? 'Retrying...' : 'Retry all drafts'}
          </button>
          <button type="button" className="compass-action-btn subtle" onClick={() => setOfflineDrafts([])} disabled={!offlineDrafts.length || busyMap.offlineRetry}>
            Clear queue
          </button>
        </div>
        {offlineDrafts.length ? (
          <div className="metric-stack">
            {offlineDrafts.slice(0, 8).map((draft) => (
              <p key={draft.id}>
                <strong>{draft.key}</strong>
                {' - queued at '}
                {new Date(draft.createdAt).toLocaleString()}
              </p>
            ))}
          </div>
        ) : (
          <p className="muted">No queued drafts right now.</p>
        )}
      </article>

      <article className="compass-card">
        <h3>Shared Context</h3>
        <div className="compass-inline-grid">
          <label>
            Appointment context
            <select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
              <option value="">Choose appointment</option>
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {formatPrettyDate(appointment.startAt)} - Dr. {appointment.doctor?.fullName || 'Doctor'}
                </option>
              ))}
            </select>
          </label>

          <label>
            Document context
            <select value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
              <option value="">Choose document</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.fileName}
                </option>
              ))}
            </select>
          </label>

          <label>
            Delegated patient
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Choose patient</option>
              {delegatedPatients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      {user.role === 'doctor' || user.role === 'admin' ? (
        <article className="compass-card">
          <h3>1) Doctor Note Drafting</h3>
          <form
            className="compass-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!appointmentId) {
                setErrorMap((prev) => ({ ...prev, draftNote: 'Select an appointment first.' }));
                return;
              }
              runFeature('draftNote', '/api/ai/draft-note', {
                appointmentId,
                focus: draftFocus
              });
            }}
          >
            <label>
              Focus (optional)
              <textarea value={draftFocus} onChange={(e) => setDraftFocus(e.target.value)} rows={3} placeholder="Example: emphasize medication adherence and red flags" />
            </label>
            <button type="submit" className="compass-action-btn small" disabled={busyMap.draftNote}>
              {busyMap.draftNote ? 'Generating...' : 'Generate Draft Note'}
            </button>
            {errorMap.draftNote ? <p className="error">{errorMap.draftNote}</p> : null}
          </form>
          {renderResult('draftNote')}
        </article>
      ) : null}

      <article className="compass-card">
        <h3>2) Patient-Friendly Visit Summary</h3>
        <form
          className="compass-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!appointmentId) {
              setErrorMap((prev) => ({ ...prev, summary: 'Select an appointment first.' }));
              return;
            }
            runFeature('summary', '/api/ai/visit-summary', {
              appointmentId,
              audience: summaryAudience,
              language: summaryLanguage
            });
          }}
        >
          <div className="compass-inline-grid">
            <label>
              Audience
              <select value={summaryAudience} onChange={(e) => setSummaryAudience(e.target.value)}>
                <option value="patient">Patient</option>
                <option value="caregiver">Caregiver</option>
                <option value="doctor">Doctor</option>
              </select>
            </label>
            <label>
              Language
              <input value={summaryLanguage} onChange={(e) => setSummaryLanguage(e.target.value)} />
            </label>
          </div>
          <button type="submit" className="compass-action-btn small" disabled={busyMap.summary}>
            {busyMap.summary ? 'Generating...' : 'Generate Visit Summary'}
          </button>
          {errorMap.summary ? <p className="error">{errorMap.summary}</p> : null}
        </form>
        {renderResult('summary')}
      </article>

      <article className="compass-card">
        <h3>3) Medication Instruction Simplifier</h3>
        <form
          className="compass-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!appointmentId) {
              setErrorMap((prev) => ({ ...prev, meds: 'Select an appointment first.' }));
              return;
            }
            runFeature('meds', '/api/ai/simplify-medication', {
              appointmentId,
              language: medLanguage,
              readingLevel: medReadingLevel
            });
          }}
        >
          <div className="compass-inline-grid">
            <label>
              Language
              <input value={medLanguage} onChange={(e) => setMedLanguage(e.target.value)} />
            </label>
            <label>
              Reading level
              <select value={medReadingLevel} onChange={(e) => setMedReadingLevel(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="standard">Standard</option>
              </select>
            </label>
          </div>
          <button type="submit" className="compass-action-btn small" disabled={busyMap.meds}>
            {busyMap.meds ? 'Generating...' : 'Simplify Medication Plan'}
          </button>
          {errorMap.meds ? <p className="error">{errorMap.meds}</p> : null}
        </form>
        {renderResult('meds')}
      </article>

      <article className="compass-card">
        <h3>4) Async Triage Assistant</h3>
        <form
          className="compass-form"
          onSubmit={(event) => {
            event.preventDefault();
            runFeature('triage', '/api/ai/triage-assist', {
              subject: triageSubject,
              symptoms: triageSymptoms,
              preferredLanguage: triageLanguage,
              priority: triagePriority,
              patientId: patientId || ''
            });
          }}
        >
          <label>
            Subject
            <input value={triageSubject} onChange={(e) => setTriageSubject(e.target.value)} required />
          </label>
          <label>
            Symptoms
            <textarea value={triageSymptoms} onChange={(e) => setTriageSymptoms(e.target.value)} rows={4} required />
          </label>
          <div className="compass-inline-grid">
            <label>
              Priority
              <select value={triagePriority} onChange={(e) => setTriagePriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              Language
              <input value={triageLanguage} onChange={(e) => setTriageLanguage(e.target.value)} />
            </label>
          </div>
          <button type="submit" className="compass-action-btn small" disabled={busyMap.triage}>
            {busyMap.triage ? 'Analyzing...' : 'Run Triage Draft'}
          </button>
          {errorMap.triage ? <p className="error">{errorMap.triage}</p> : null}
        </form>
        {renderResult('triage')}
      </article>

      <article className="compass-card">
        <h3>5) Reminder Text Generation</h3>
        <form
          className="compass-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!appointmentId) {
              setErrorMap((prev) => ({ ...prev, reminder: 'Select an appointment first.' }));
              return;
            }
            runFeature('reminder', '/api/ai/reminder-text', {
              appointmentId,
              tone: reminderTone,
              channel: reminderChannel,
              language: reminderLanguage
            });
          }}
        >
          <div className="compass-inline-grid">
            <label>
              Tone
              <select value={reminderTone} onChange={(e) => setReminderTone(e.target.value)}>
                <option value="warm">Warm</option>
                <option value="formal">Formal</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label>
              Channel
              <select value={reminderChannel} onChange={(e) => setReminderChannel(e.target.value)}>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </label>
            <label>
              Language
              <input value={reminderLanguage} onChange={(e) => setReminderLanguage(e.target.value)} />
            </label>
          </div>
          <button type="submit" className="compass-action-btn small" disabled={busyMap.reminder}>
            {busyMap.reminder ? 'Generating...' : 'Generate Reminder Draft'}
          </button>
          {errorMap.reminder ? <p className="error">{errorMap.reminder}</p> : null}
        </form>
        {renderResult('reminder')}
      </article>

      <article className="compass-card">
        <h3>6) Document Assistant with Source Snippets</h3>
        <form
          className="compass-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!documentId) {
              setErrorMap((prev) => ({ ...prev, document: 'Select a document first.' }));
              return;
            }
            runFeature('document', '/api/ai/document-assist', {
              documentId,
              question: documentQuestion,
              language: documentLanguage
            });
          }}
        >
          <label>
            Your question
            <textarea
              value={documentQuestion}
              onChange={(e) => setDocumentQuestion(e.target.value)}
              rows={3}
              required
              placeholder="Example: What dosage pattern is mentioned for this medication?"
            />
          </label>
          <label>
            Language
            <input value={documentLanguage} onChange={(e) => setDocumentLanguage(e.target.value)} />
          </label>
          <button type="submit" className="compass-action-btn small" disabled={busyMap.document}>
            {busyMap.document ? 'Analyzing...' : 'Ask Document Assistant'}
          </button>
          {errorMap.document ? <p className="error">{errorMap.document}</p> : null}
        </form>
        {renderResult('document')}
      </article>

      <article className="compass-card">
        <h3>7) Help Worker Guidance Cards</h3>
        <form
          className="compass-form"
          onSubmit={(event) => {
            event.preventDefault();
            runFeature('guidance', '/api/ai/helper-guidance', {
              patientId: patientId || '',
              goal: guidanceGoal,
              language: guidanceLanguage
            });
          }}
        >
          <label>
            Goal
            <textarea value={guidanceGoal} onChange={(e) => setGuidanceGoal(e.target.value)} rows={3} required />
          </label>
          <label>
            Language
            <input value={guidanceLanguage} onChange={(e) => setGuidanceLanguage(e.target.value)} />
          </label>
          <button type="submit" className="compass-action-btn small" disabled={busyMap.guidance}>
            {busyMap.guidance ? 'Generating...' : 'Generate Guidance Cards'}
          </button>
          {errorMap.guidance ? <p className="error">{errorMap.guidance}</p> : null}
        </form>
        {renderResult('guidance')}
      </article>

      <article className="compass-card">
        <h3>8) Multilingual Translation for Chat</h3>
        <form
          className="compass-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!appointmentId) {
              setErrorMap((prev) => ({ ...prev, translate: 'Select an appointment first.' }));
              return;
            }
            runFeature('translate', '/api/ai/translate-chat', {
              appointmentId,
              text: translationText,
              sourceLanguage: translationSourceLanguage,
              targetLanguage: translationTargetLanguage
            });
          }}
        >
          <label>
            Chat text
            <textarea value={translationText} onChange={(e) => setTranslationText(e.target.value)} rows={3} required />
          </label>
          <div className="compass-inline-grid">
            <label>
              Source language
              <input value={translationSourceLanguage} onChange={(e) => setTranslationSourceLanguage(e.target.value)} />
            </label>
            <label>
              Target language
              <input value={translationTargetLanguage} onChange={(e) => setTranslationTargetLanguage(e.target.value)} required />
            </label>
          </div>
          <button type="submit" className="compass-action-btn small" disabled={busyMap.translate}>
            {busyMap.translate ? 'Translating...' : 'Translate Chat Message'}
          </button>
          {errorMap.translate ? <p className="error">{errorMap.translate}</p> : null}
        </form>
        {renderResult('translate')}
      </article>
    </section>
  );
}

function ProfilePage() {
  const { data, setData, error, loading } = useApiPage('/api/users/me');
  const [message, setMessage] = useState('');

  if (loading) return <p className="muted">Loading profile...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data?.user) return <p className="error">Profile not found.</p>;

  const user = data.user;

  const save = async (event) => {
    event.preventDefault();
    setMessage('');
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());

    const res = await apiRequest('/api/users/me', { method: 'POST', body });
    if (!res.ok) {
      setMessage(res.data?.error || 'Could not update profile.');
      return;
    }
    setData(res.data);
    setMessage(res.data?.message || 'Profile saved.');
  };

  return (
    <section className="journey-profile-shell">
      <header className="journey-profile-hero">
        <div className="journey-profile-avatar">{String(user.fullName || 'U').slice(0, 1).toUpperCase()}</div>
        <div>
          <h2 className="journey-title">My Profile</h2>
          <p className="journey-sub">Manage your health records and contact details.</p>
        </div>
      </header>

      {message ? <p className={message.toLowerCase().includes('could not') ? 'error' : 'success'}>{message}</p> : null}

      <form className="journey-profile-form" onSubmit={save}>
        <section className="journey-form-card">
          <div className="journey-form-head">
            <span className="material-symbols-outlined" aria-hidden="true">person</span>
            <h3>Personal Information</h3>
          </div>

          <div className="journey-form-grid two-col">
            <label>
              Full name
              <input name="fullName" defaultValue={user.fullName || ''} required />
            </label>
            <label>
              Phone number
              <input name="phone" defaultValue={user.phone || ''} />
            </label>
            <label>
              Gender
              <input name="gender" defaultValue={user.gender || ''} />
            </label>
            <label>
              Home address
              <input name="address" defaultValue={user.address || ''} />
            </label>
            <label>
              Primary language
              <input name="language" defaultValue={user.language || ''} />
            </label>
            <label>
              Time zone
              <input name="timeZone" defaultValue={user.timeZone || ''} />
            </label>
          </div>
        </section>

        {user.role === 'patient' ? (
          <section className="journey-form-card">
            <div className="journey-form-head">
              <span className="material-symbols-outlined" aria-hidden="true">medical_information</span>
              <h3>Health Information</h3>
            </div>

            <label>
              Chronic conditions
              <textarea name="chronicConditions" defaultValue={user.patientProfile?.chronicConditions || ''} />
            </label>
            <label>
              Basic health info
              <textarea name="basicHealthInfo" defaultValue={user.patientProfile?.basicHealthInfo || ''} />
            </label>
          </section>
        ) : null}

        {user.role === 'doctor' ? (
          <section className="journey-form-card">
            <div className="journey-form-head">
              <span className="material-symbols-outlined" aria-hidden="true">stethoscope</span>
              <h3>Doctor Details</h3>
            </div>

            <div className="journey-form-grid two-col">
              <label>
                Specialization
                <input name="specialization" defaultValue={user.doctorProfile?.specialization || ''} />
              </label>
              <label>
                Years of experience
                <input name="yearsOfExperience" defaultValue={user.doctorProfile?.yearsOfExperience || ''} />
              </label>
              <label>
                Qualifications
                <input name="qualifications" defaultValue={user.doctorProfile?.qualifications || ''} />
              </label>
              <label>
                Clinic
                <input name="clinicName" defaultValue={user.doctorProfile?.clinicName || ''} />
              </label>
              <label>
                Consultation languages
                <input name="consultationLanguages" defaultValue={user.doctorProfile?.consultationLanguages || ''} />
              </label>
            </div>

            <label>
              Description
              <textarea name="description" defaultValue={user.doctorProfile?.description || ''} />
            </label>
          </section>
        ) : null}

        <div className="journey-save-wrap">
          <button type="submit" className="journey-cta secondary full">Save Changes</button>
        </div>
      </form>
    </section>
  );
}

function PatientHealthPage() {
  const { data, setData, error, loading } = useApiPage('/api/patients/me');
  const [message, setMessage] = useState('');

  if (loading) return <p className="muted">Loading health profile...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data?.user) return <p className="error">Health profile unavailable.</p>;

  const save = async (event) => {
    event.preventDefault();
    setMessage('');
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    const res = await apiRequest('/api/patients/me', { method: 'POST', body });
    if (!res.ok) {
      setMessage(res.data?.error || 'Could not save health profile.');
      return;
    }
    setData(res.data);
    setMessage(res.data?.message || 'Saved.');
  };

  return (
    <section className="card">
      <h2>My health profile</h2>
      {message ? <p className={message.toLowerCase().includes('could not') ? 'error' : 'success'}>{message}</p> : null}
      <form className="stack" onSubmit={save}>
        <label>
          Chronic conditions
          <textarea name="chronicConditions" defaultValue={data.user.patientProfile?.chronicConditions || ''} />
        </label>
        <label>
          Basic health info
          <textarea name="basicHealthInfo" defaultValue={data.user.patientProfile?.basicHealthInfo || ''} />
        </label>
        <button type="submit">Save</button>
      </form>
    </section>
  );
}

function PatientWorkspacePage() {
  const { data, error, loading, reload } = useApiPage('/api/patients/workspace');
  const [feedback, setFeedback] = useState('');

  if (loading) return <p className="muted">Loading family and records...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data?.user) return <p className="error">Family and records unavailable.</p>;

  const uploadDocument = async (event) => {
    event.preventDefault();
    setFeedback('');
    const formData = new FormData(event.currentTarget);
    const res = await apiRequest('/api/documents/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      setFeedback(res.data?.error || 'Upload failed.');
      return;
    }
    setFeedback('Upload complete.');
    event.currentTarget.reset();
  };

  const createFamilyMember = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const res = await apiRequest('/api/patients/family-members', { method: 'POST', body });
    if (!res.ok) {
      setFeedback(res.data?.error || res.data?.message || 'Unable to add family member.');
      return;
    }
    setFeedback('Family member saved.');
    event.currentTarget.reset();
    reload();
  };

  const updateFamilyMember = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const res = await apiRequest('/api/patients/family-members/update', { method: 'POST', body });
    if (!res.ok) {
      setFeedback(res.data?.error || res.data?.message || 'Unable to update family member.');
      return;
    }
    setFeedback('Family member updated.');
    reload();
  };

  return (
    <>
      <section className="journey-hero">
        <h2 className="journey-title">Patient Workspace</h2>
        <p className="journey-sub">Manage your personal profile, family members, and health history in your digital sanctuary.</p>
        {feedback ? <p className="journey-status-note">{feedback}</p> : null}
      </section>

      <section className="journey-workspace-grid">
        <article className="journey-upload-card">
          <div className="journey-form-head">
            <span className="material-symbols-outlined" aria-hidden="true">cloud_upload</span>
            <h3>Upload Medical Document</h3>
          </div>

          <form className="stack" onSubmit={uploadDocument}>
            <label>
              Upload for
              <select name="uploadFor" defaultValue="user" required>
                <option value="user">{data.user.fullName} (Self)</option>
                {(data.user.familyMembers || []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                    {member.relationToPatient ? ` (${member.relationToPatient})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              File
              <input type="file" name="file" required />
            </label>

            <button type="submit" className="journey-cta">Upload Document</button>
          </form>
        </article>

        <article className="journey-family-sidebar">
          <h3>Family Members</h3>
          {(data.user.familyMembers || []).length === 0 ? <p className="journey-empty-note">No family members yet.</p> : null}
          {(data.user.familyMembers || []).map((member) => (
            <form className="journey-family-card" key={member.id} onSubmit={updateFamilyMember}>
              <input type="hidden" name="familyMemberId" defaultValue={member.id} />
              <div className="journey-family-card-head">
                <h4>{member.fullName}</h4>
                <span>{member.relationToPatient || 'Family'}</span>
              </div>

              <div className="journey-family-grid">
                <label>
                  Full name
                  <input name="fullName" defaultValue={member.fullName || ''} required />
                </label>
                <label>
                  Relation
                  <input name="relationToPatient" defaultValue={member.relationToPatient || ''} />
                </label>
                <label>
                  Gender
                  <input name="gender" defaultValue={member.gender || ''} />
                </label>
                <label>
                  Date of birth
                  <input
                    type="date"
                    name="dateOfBirth"
                    defaultValue={member.dateOfBirth ? new Date(member.dateOfBirth).toISOString().slice(0, 10) : ''}
                  />
                </label>
              </div>

              <label>
                Health info
                <textarea name="basicHealthInfo" defaultValue={member.basicHealthInfo || ''} />
              </label>

              <label>
                Chronic conditions
                <textarea name="chronicConditions" defaultValue={member.chronicConditions || ''} />
              </label>

              <button type="submit" className="journey-cta subtle full">Update</button>
            </form>
          ))}
        </article>
      </section>

      <section className="journey-editorial-card">
        <div className="journey-editorial-copy">
          <h3>Add Family Member</h3>
          <p>
            Ensure everyone in your household gets the best care. Adding family members allows quick appointment booking
            and shared health records.
          </p>
        </div>

        <form className="journey-editorial-form" onSubmit={createFamilyMember}>
          <label>
            Full name
            <input name="fullName" required />
          </label>
          <label>
            Relation
            <input name="relationToPatient" />
          </label>
          <label>
            Gender
            <input name="gender" />
          </label>
          <label>
            Date of birth
            <input type="date" name="dateOfBirth" />
          </label>
          <label className="wide">
            Chronic conditions
            <textarea name="chronicConditions" />
          </label>
          <label className="wide">
            Basic health info
            <textarea name="basicHealthInfo" />
          </label>
          <button type="submit" className="journey-cta secondary wide">Save Family Member</button>
        </form>
      </section>

      <section className="journey-section">
        <div className="journey-section-head">
          <h3>Consultation History</h3>
        </div>

        {(data.completedAppointments || []).length === 0 ? (
          <p className="journey-empty-note">No completed consultations yet.</p>
        ) : null}

        <div className="journey-timeline">
          {(data.completedAppointments || []).map((appointment) => (
            <article className="journey-timeline-item" key={appointment.id}>
              <div className="journey-timeline-dot" aria-hidden="true" />
              <div className="journey-timeline-card">
                <div>
                  <span className="journey-time-pill">{utcDateTime(appointment.startAt)}</span>
                  <h4>{`Consultation with Dr. ${appointment.doctor.fullName}`}</h4>
                  <p>
                    For: {appointment.familyMember ? appointment.familyMember.fullName : data.user.fullName}
                  </p>
                </div>
                <div className="journey-timeline-diagnosis">
                  <p>Diagnosis</p>
                  <strong>{appointment.prescription?.diagnosis || 'No prescription'}</strong>
                </div>
                {appointment.prescription ? (
                  <a className="journey-cta subtle" href={`/api/prescriptions/${appointment.id}/pdf`} target="_blank" rel="noreferrer">
                    Download PDF
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function RemindersPage() {
  const { user } = useSession();
  const { data, error, loading, reload } = useApiPage('/api/reminders');
  const [dispatching, setDispatching] = useState(false);
  const [message, setMessage] = useState('');

  const canDispatch = user.role === 'doctor' || user.role === 'admin';

  const dispatchDue = async () => {
    setDispatching(true);
    setMessage('');

    try {
      const res = await apiRequest('/api/reminders/dispatch', {
        method: 'POST',
        body: { limit: 30 }
      });

      if (!res.ok) {
        setMessage(res.data?.error || 'Unable to dispatch reminders right now.');
        return;
      }

      setMessage(`Dispatch complete. Sent ${res.data?.sent || 0}, failed ${res.data?.failed || 0}.`);
      reload();
    } catch (_err) {
      setMessage('Dispatch failed due to network issues.');
    } finally {
      setDispatching(false);
    }
  };

  if (loading) return <p className="muted">Loading reminders...</p>;
  if (error) return <p className="error">{error}</p>;

  const summary = data?.summary || { scheduled: 0, sent: 0, failed: 0, skipped: 0 };
  const timeline = data?.timeline || [];

  return (
    <section className="compass-shell">
      <header className="compass-hero">
        <p className="kicker">Digital Sanctuary</p>
        <h2>Reminder Compass</h2>
        <p>
          One step at a time. Confirm upcoming nudges, then trigger due reminders when network is available.
        </p>
        <Link className="compass-link-btn" to="/ai-copilot">
          Open AI reminder drafts
        </Link>
      </header>

      {data?.unsupported ? (
        <p className="error">Reminder pipeline is unavailable until the latest Prisma migration is applied.</p>
      ) : null}

      {message ? <p className={message.toLowerCase().includes('failed') ? 'error' : 'success'}>{message}</p> : null}

      <section className="compass-metric-grid">
        <article className="compass-metric-card">
          <h3>Scheduled</h3>
          <strong>{summary.scheduled || 0}</strong>
        </article>
        <article className="compass-metric-card accent">
          <h3>Sent</h3>
          <strong>{summary.sent || 0}</strong>
        </article>
        <article className="compass-metric-card">
          <h3>Failed</h3>
          <strong>{summary.failed || 0}</strong>
        </article>
        <article className="compass-metric-card">
          <h3>Skipped</h3>
          <strong>{summary.skipped || 0}</strong>
        </article>
      </section>

      {canDispatch ? (
        <button type="button" className="compass-action-btn" onClick={dispatchDue} disabled={dispatching || data?.unsupported}>
          <span className="material-symbols-outlined" aria-hidden="true">notifications_active</span>
          {dispatching ? 'Sending...' : 'Send Due Reminders Now'}
        </button>
      ) : (
        <p className="muted">Reminders are sent automatically by your care team.</p>
      )}

      <div className="compass-list">
        {timeline.length === 0 ? <p className="muted">No reminder activity yet.</p> : null}

        {timeline.map((item) => (
          <article className="compass-row" key={item.id}>
            <div className="compass-row-main">
              <h4>
                {user.role === 'patient'
                  ? `Visit with Dr. ${item.appointment?.doctor?.fullName || 'Doctor'}`
                  : `${item.patient?.fullName || 'Patient'} reminder`}
              </h4>
              <p>
                Appointment: {formatPrettyDate(item.appointment?.startAt)} at {formatPrettyTime(item.appointment?.startAt)}
              </p>
              <p>Planned send time: {utcDateTime(item.sendAt)}</p>
            </div>
            <span className={`compass-status-pill ${String(item.status || '').toLowerCase()}`}>{item.status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function CareSupportPage() {
  const { user } = useSession();
  const { data, error, loading, reload } = useApiPage('/api/support/consents');
  const [feedback, setFeedback] = useState('');

  const addHelper = async (event) => {
    event.preventDefault();
    setFeedback('');

    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const res = await apiRequest('/api/support/helpers', { method: 'POST', body });
    if (!res.ok) {
      setFeedback(res.data?.error || 'Could not save helper details.');
      return;
    }

    setFeedback('Helper profile saved.');
    event.currentTarget.reset();
    reload();
  };

  const grantConsent = async (event) => {
    event.preventDefault();
    setFeedback('');

    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const res = await apiRequest('/api/support/consents', { method: 'POST', body });
    if (!res.ok) {
      setFeedback(res.data?.error || 'Could not grant consent.');
      return;
    }

    setFeedback('Consent granted and logged.');
    event.currentTarget.reset();
    reload();
  };

  const toggleHelper = async (helper) => {
    setFeedback('');

    const res = await apiRequest(`/api/support/helpers/${helper.id}/toggle`, {
      method: 'POST',
      body: { active: !helper.isActive }
    });

    if (!res.ok) {
      setFeedback(res.data?.error || 'Could not update helper status.');
      return;
    }

    setFeedback(`Helper ${!helper.isActive ? 'activated' : 'deactivated'}.`);
    reload();
  };

  if (loading) return <p className="muted">Loading care support...</p>;
  if (error) return <p className="error">{error}</p>;

  const helpers = data?.helpers || [];
  const activeConsents = data?.activeConsents || [];
  const history = data?.history || [];
  const upcomingAppointments = data?.upcomingAppointments || [];
  const canManage = Boolean(data?.canManage && user.role === 'patient');

  return (
    <section className="compass-shell">
      <header className="compass-hero">
        <p className="kicker">Guided Compass</p>
        <h2>Care Support & Consent</h2>
        <p>Register trusted helpers, then grant clear consent for appointment or async-consult assistance.</p>
        <Link className="compass-link-btn" to="/ai-copilot">
          Generate helper guidance cards
        </Link>
      </header>

      {data?.unsupported ? <p className="error">Care-support tables are missing. Apply the latest migration.</p> : null}
      {feedback ? <p className={feedback.toLowerCase().includes('could not') ? 'error' : 'success'}>{feedback}</p> : null}
      {user.role === 'help_worker' ? <p className="muted">Showing active consent records linked to your helper phone number.</p> : null}

      {canManage ? (
        <div className="compass-two-col">
          <article className="compass-card">
            <h3>Step 1: Add Helper</h3>
            <form className="compass-form" onSubmit={addHelper}>
              <label>
                Helper name
                <input name="helperName" required />
              </label>
              <label>
                Phone number
                <input name="helperPhone" required />
              </label>
              <label>
                Relation
                <input name="relationToPatient" />
              </label>
              <label>
                Village or area
                <input name="village" />
              </label>
              <label>
                Notes
                <textarea name="notes" rows={3} />
              </label>
              <button type="submit" className="compass-action-btn small">Save Helper</button>
            </form>
          </article>

          <article className="compass-card">
            <h3>Step 2: Grant Consent</h3>
            <form className="compass-form" onSubmit={grantConsent}>
              <label>
                Select helper
                <select name="helperId" required defaultValue="">
                  <option value="" disabled>Choose helper</option>
                  {helpers
                    .filter((helper) => helper.isActive)
                    .map((helper) => (
                      <option key={helper.id} value={helper.id}>
                        {helper.helperName} ({helper.helperPhone})
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Consent scope
                <select name="scope" defaultValue="appointment">
                  <option value="appointment">Appointment help</option>
                  <option value="async_consult">Async consult follow-up</option>
                  <option value="records">Records and documents</option>
                  <option value="all">All supported actions</option>
                </select>
              </label>

              <label>
                Optional appointment
                <select name="appointmentId" defaultValue="">
                  <option value="">Any appointment</option>
                  {upcomingAppointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>
                      {formatPrettyDate(appointment.startAt)} - Dr. {appointment.doctor?.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Notes
                <textarea name="notes" rows={3} />
              </label>

              <button type="submit" className="compass-action-btn small">Grant Consent</button>
            </form>
          </article>
        </div>
      ) : null}

      {canManage ? (
        <article className="compass-card">
          <h3>Helper Directory</h3>
          {(helpers || []).length === 0 ? <p className="muted">No helper profiles yet.</p> : null}
          <div className="compass-list">
            {helpers.map((helper) => (
              <article className="compass-row" key={helper.id}>
                <div className="compass-row-main">
                  <h4>{helper.helperName}</h4>
                  <p>{helper.helperPhone}</p>
                  <p>{helper.relationToPatient || 'Community helper'}</p>
                </div>
                <button type="button" className="compass-toggle-btn" onClick={() => toggleHelper(helper)}>
                  {helper.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </article>
            ))}
          </div>
        </article>
      ) : null}

      <article className="compass-card">
        <h3>Active Consent Log</h3>
        {(activeConsents || []).length === 0 ? <p className="muted">No active consent records.</p> : null}
        <div className="compass-list">
          {activeConsents.map((consent) => (
            <article className="compass-row" key={consent.id}>
              <div className="compass-row-main">
                <h4>
                  {consent.helper?.helperName || consent.patient?.fullName || 'Care helper'} - {consent.scope}
                </h4>
                <p>{consent.notes || 'No notes added.'}</p>
                {consent.appointment ? (
                  <p>
                    Linked appointment: {formatPrettyDate(consent.appointment.startAt)} with Dr.{' '}
                    {consent.appointment.doctor?.fullName}
                  </p>
                ) : null}
              </div>
              <span className="compass-status-pill sent">active</span>
            </article>
          ))}
        </div>
      </article>

      <article className="compass-card">
        <h3>Audit Timeline</h3>
        {(history || []).length === 0 ? <p className="muted">No audit entries yet.</p> : null}
        <div className="compass-list">
          {history.map((entry) => (
            <article className="compass-row" key={entry.id}>
              <div className="compass-row-main">
                <h4>{entry.action}</h4>
                <p>{entry.helper?.helperName || entry.patient?.fullName || 'Care helper context'}</p>
                <p>{utcDateTime(entry.createdAt)}</p>
              </div>
              <span className={`compass-status-pill ${entry.isActive ? 'sent' : 'skipped'}`}>
                {entry.isActive ? 'active' : 'closed'}
              </span>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

function AsyncConsultsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApiPage('/api/async-consults');
  const [doctors, setDoctors] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [delegatedPatients, setDelegatedPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [createMessage, setCreateMessage] = useState('');
  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    familyMemberId: '',
    appointmentId: '',
    subject: '',
    symptoms: '',
    preferredLanguage: 'Hindi',
    priority: 'medium'
  });

  useEffect(() => {
    if (user.role !== 'patient' && user.role !== 'help_worker') return;

    const loadContext = async () => {
      try {
        const [doctorsRes, contextRes, appointmentsRes] = await Promise.all([
          apiRequest('/api/doctors'),
          user.role === 'patient' ? apiRequest('/api/patients/workspace') : apiRequest('/api/support/consents'),
          apiRequest('/api/appointments')
        ]);

        if (doctorsRes.ok) {
          const loadedDoctors = doctorsRes.data?.doctors || [];
          setDoctors(loadedDoctors);
          if (!form.doctorId && loadedDoctors.length) {
            setForm((prev) => ({ ...prev, doctorId: loadedDoctors[0].id }));
          }
        }

        if (user.role === 'patient') {
          setDelegatedPatients([]);
          if (contextRes.ok) {
            setFamilyMembers(contextRes.data?.user?.familyMembers || []);
          }
        } else {
          setFamilyMembers([]);
          const patientMap = new Map();
          (contextRes.data?.activeConsents || []).forEach((consent) => {
            const patient = consent?.patient;
            if (patient?.id && !patientMap.has(patient.id)) {
              patientMap.set(patient.id, { id: patient.id, fullName: patient.fullName || 'Patient' });
            }
          });

          const scopedPatients = [...patientMap.values()];
          setDelegatedPatients(scopedPatients);
          if (scopedPatients.length && !form.patientId) {
            setForm((prev) => ({ ...prev, patientId: scopedPatients[0].id }));
          }
        }

        if (appointmentsRes.ok) {
          setAppointments((appointmentsRes.data?.upcomingAppointments || []).slice(0, 20));
        }
      } catch (_err) {
        setCreateMessage('Could not load full consult form options. You can still continue.');
      }
    };

    loadContext();
  }, [form.doctorId, user.role]);

  const submitAsyncConsult = async (event) => {
    event.preventDefault();
    setCreateMessage('');

    const payload = user.role === 'help_worker' ? form : { ...form, patientId: '' };

    const res = await apiRequest('/api/async-consults', {
      method: 'POST',
      body: payload
    });

    if (!res.ok) {
      setCreateMessage(res.data?.error || 'Unable to start async consult.');
      return;
    }

    if (res.data?.redirectTo) {
      navigate(res.data.redirectTo);
      return;
    }

    setCreateMessage('Async consult started.');
    reload();
  };

  if (loading) return <p className="muted">Loading asynchronous consults...</p>;
  if (error) return <p className="error">{error}</p>;

  const consultations = data?.consultations || [];
  const stats = data?.queueStats || { total: 0, waitingDoctor: 0, waitingPatient: 0, closed: 0 };
  const messageIsError = /unable|error|could not|do not have|select/i.test(String(createMessage || '').toLowerCase());

  return (
    <section className="compass-shell">
      <header className="compass-hero">
        <p className="kicker">Digital Sanctuary</p>
        <h2>{user.role === 'doctor' ? 'Asynchronous Consult Queue' : 'Asynchronous Consult'}</h2>
        <p>When calls are not possible, continue care through clear messages and step-by-step updates.</p>
      </header>

      {data?.unsupported ? <p className="error">Async consult tables are missing. Apply the latest migration.</p> : null}
      {data?.guidance ? <p className="muted">{data.guidance}</p> : null}

      <section className="compass-metric-grid">
        <article className="compass-metric-card">
          <h3>Total</h3>
          <strong>{stats.total}</strong>
        </article>
        <article className="compass-metric-card accent">
          <h3>Waiting Doctor</h3>
          <strong>{stats.waitingDoctor}</strong>
        </article>
        <article className="compass-metric-card">
          <h3>Waiting Patient</h3>
          <strong>{stats.waitingPatient}</strong>
        </article>
        <article className="compass-metric-card">
          <h3>Closed</h3>
          <strong>{stats.closed}</strong>
        </article>
      </section>

      {user.role === 'patient' || user.role === 'help_worker' ? (
        <article className="compass-card">
          <h3>{user.role === 'help_worker' ? 'Step 1: Start a Delegated Async Consult' : 'Step 1: Start a New Async Consult'}</h3>
          <form className="compass-form" onSubmit={submitAsyncConsult}>
            {user.role === 'help_worker' ? (
              <>
                <label>
                  Delegated patient
                  <select
                    value={form.patientId}
                    onChange={(e) => setForm((prev) => ({ ...prev, patientId: e.target.value }))}
                    required
                  >
                    <option value="" disabled>Choose patient</option>
                    {delegatedPatients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                {delegatedPatients.length === 0 ? (
                  <p className="muted">No delegated patients found. Ask a patient to grant active async-consult consent first.</p>
                ) : null}
              </>
            ) : null}

            <label>
              Select doctor
              <select value={form.doctorId} onChange={(e) => setForm((prev) => ({ ...prev, doctorId: e.target.value }))} required>
                <option value="" disabled>Choose doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.fullName}
                  </option>
                ))}
              </select>
            </label>

            {user.role === 'patient' ? (
              <label>
                For whom
                <select
                  value={form.familyMemberId}
                  onChange={(e) => setForm((prev) => ({ ...prev, familyMemberId: e.target.value }))}
                >
                  <option value="">Myself</option>
                  {familyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              Link appointment (optional)
              <select
                value={form.appointmentId}
                onChange={(e) => setForm((prev) => ({ ...prev, appointmentId: e.target.value }))}
              >
                <option value="">No linked appointment</option>
                {appointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {formatPrettyDate(appointment.startAt)} - Dr. {appointment.doctor?.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Subject
              <input
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Example: Night fever and weakness"
                required
              />
            </label>

            <label>
              Symptoms and details
              <textarea
                value={form.symptoms}
                onChange={(e) => setForm((prev) => ({ ...prev, symptoms: e.target.value }))}
                rows={5}
                required
              />
            </label>

            <div className="compass-inline-grid">
              <label>
                Preferred language
                <input
                  value={form.preferredLanguage}
                  onChange={(e) => setForm((prev) => ({ ...prev, preferredLanguage: e.target.value }))}
                />
              </label>

              <label>
                Priority
                <select value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>

            <button type="submit" className="compass-action-btn small" disabled={user.role === 'help_worker' && !delegatedPatients.length}>
              Send to Doctor
            </button>
            {createMessage ? <p className={messageIsError ? 'error' : 'success'}>{createMessage}</p> : null}
          </form>
        </article>
      ) : null}

      <article className="compass-card">
        <h3>Step 2: Continue Existing Threads</h3>
        {consultations.length === 0 ? <p className="muted">No async consults in your queue.</p> : null}
        <div className="compass-list">
          {consultations.map((consult) => (
            <article className="compass-row" key={consult.id}>
              <div className="compass-row-main">
                <h4>{consult.subject}</h4>
                <p>
                  {user.role === 'doctor'
                    ? `Patient: ${consult.patient?.fullName || 'Unknown'}`
                    : user.role === 'help_worker'
                      ? `Patient: ${consult.patient?.fullName || 'Unknown'} • Doctor: Dr. ${consult.doctor?.fullName || 'Unknown'}`
                      : `Doctor: Dr. ${consult.doctor?.fullName || 'Unknown'}`}
                </p>
                <p>
                  Last update: {utcDateTime(consult.latestMessageAt)} • Replies: {consult._count?.replies || 0}
                </p>
                {consult.replies?.[0]?.message ? <p>Latest: {consult.replies[0].message}</p> : null}
              </div>
              <div className="compass-row-actions">
                <span className={`compass-status-pill ${String(consult.status || '').toLowerCase()}`}>{consult.status}</span>
                <span className={`compass-presence ${consult.presence?.doctorOnline || consult.presence?.patientOnline ? 'online' : 'offline'}`}>
                  {consult.presence?.doctorOnline || consult.presence?.patientOnline ? 'Peer online' : 'Peer offline'}
                </span>
                <Link className="compass-link-btn" to={`/async-consults/${consult.id}`}>
                  Open
                </Link>
              </div>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

function AsyncConsultDetailPage() {
  const { consultId } = useParams();
  const { user } = useSession();
  const { data, setData, error, loading, reload } = useApiPage(`/api/async-consults/${consultId}`);
  const [replyMessage, setReplyMessage] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!consultId) return undefined;

    const tick = async () => {
      try {
        await apiRequest('/api/users/presence/ping', { method: 'POST' });
        const res = await apiRequest(`/api/async-consults/${consultId}`);
        if (res.ok) {
          setData(res.data);
        }
      } catch (_err) {
        // silent retry loop for low-connectivity environments
      }
    };

    tick();
    const timer = setInterval(tick, user.role === 'doctor' ? 15000 : 20000);
    return () => clearInterval(timer);
  }, [consultId, setData, user.role]);

  const sendReply = async (event) => {
    event.preventDefault();
    setFeedback('');

    const text = String(replyMessage || '').trim();
    if (!text) {
      setFeedback('Reply message is required.');
      return;
    }

    const res = await apiRequest(`/api/async-consults/${consultId}/replies`, {
      method: 'POST',
      body: { message: text }
    });

    if (!res.ok) {
      setFeedback(res.data?.error || 'Could not send reply.');
      return;
    }

    setFeedback('Reply sent.');
    setReplyMessage('');
    if (res.data?.consult) {
      setData((prev) => ({ ...(prev || {}), consult: res.data.consult, presence: res.data.presence }));
      return;
    }
    reload();
  };

  const closeThread = async () => {
    setFeedback('');

    const res = await apiRequest(`/api/async-consults/${consultId}/close`, {
      method: 'POST',
      body: { reason: closeReason }
    });

    if (!res.ok) {
      setFeedback(res.data?.error || 'Could not close conversation.');
      return;
    }

    setFeedback('Conversation closed.');
    reload();
  };

  if (loading) return <p className="muted">Loading async consult thread...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data?.consult) return <p className="error">Async consult not found.</p>;

  const consult = data.consult;
  const presence = data.presence || { doctorOnline: false, patientOnline: false };
  const peerOnline = user.role === 'doctor' ? presence.patientOnline : presence.doctorOnline;

  return (
    <section className="compass-shell">
      <header className="compass-hero">
        <p className="kicker">Guided Conversation</p>
        <h2>{consult.subject}</h2>
        <p>
          {user.role === 'doctor'
            ? `Patient: ${consult.patient?.fullName || 'Unknown'}`
            : user.role === 'help_worker'
              ? `Patient: ${consult.patient?.fullName || 'Unknown'} • Doctor: Dr. ${consult.doctor?.fullName || 'Unknown'}`
              : `Doctor: Dr. ${consult.doctor?.fullName || 'Unknown'}`}
        </p>
        <div className="compass-inline-status">
          <span className={`compass-status-pill ${String(consult.status || '').toLowerCase()}`}>{consult.status}</span>
          <span className={`compass-presence ${peerOnline ? 'online' : 'offline'}`}>
            {peerOnline ? 'Peer online now' : 'Peer offline'}
          </span>
        </div>
        <Link className="compass-link-btn" to={`/ai-copilot?appointmentId=${consult.appointmentId || ''}`}>
          Open AI triage & translation tools
        </Link>
      </header>

      {feedback ? <p className={feedback.toLowerCase().includes('could not') ? 'error' : 'success'}>{feedback}</p> : null}

      <article className="compass-card">
        <h3>Conversation Timeline</h3>
        <div className="compass-chat-thread">
          {(consult.replies || []).map((reply) => {
            const mine = reply.authorId === user.id;
            return (
              <article className={`compass-chat-bubble ${mine ? 'mine' : ''}`} key={reply.id}>
                <p className="compass-chat-meta">
                  {reply.authorName || reply.authorRole} - {utcDateTime(reply.createdAt)}
                </p>
                <p>{reply.message}</p>
              </article>
            );
          })}
        </div>
      </article>

      {consult.status !== 'closed' ? (
        <article className="compass-card">
          <h3>Next Step</h3>
          <form className="compass-form" onSubmit={sendReply}>
            <label>
              Message
              <textarea value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} rows={4} required />
            </label>
            <button type="submit" className="compass-action-btn small">
              <span className="material-symbols-outlined" aria-hidden="true">send</span>
              Send Reply
            </button>
          </form>

          <div className="compass-close-stack">
            <label>
              Close reason (optional)
              <input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
            </label>
            <button type="button" className="compass-action-btn small subtle" onClick={closeThread}>
              <span className="material-symbols-outlined" aria-hidden="true">task_alt</span>
              Close Conversation
            </button>
          </div>
        </article>
      ) : (
        <p className="success">This asynchronous consult is closed.</p>
      )}
    </section>
  );
}

function DoctorSlotsPage() {
  const { data, error, loading, reload } = useApiPage('/api/doctors/me/slots');
  const [message, setMessage] = useState('');
  const [slotFilter, setSlotFilter] = useState('all');
  const [bulkForm, setBulkForm] = useState({
    date: '',
    startHourUtc: '',
    endHourUtc: '',
    action: 'make_available'
  });

  const setCallState = async (state) => {
    const res = await apiRequest('/api/doctors/me/call-state', {
      method: 'POST',
      body: { state }
    });
    if (!res.ok) {
      setMessage(res.data?.error || 'Unable to change call state.');
      return;
    }
    setMessage(`Call state changed to ${state}.`);
    reload();
  };

  const bulkUpdate = async (event) => {
    event.preventDefault();
    const res = await apiRequest('/api/doctors/me/slots/bulk', {
      method: 'POST',
      body: bulkForm
    });
    if (!res.ok) {
      setMessage(res.data?.error || res.data?.message || 'Unable to update slots.');
      return;
    }
    setMessage('Slots updated.');
    reload();
  };

  if (loading) return <p className="muted">Loading slots...</p>;
  if (error) return <p className="error">{error}</p>;

  const slots = data?.slots || [];
  const filteredSlots =
    slotFilter === 'all' ? slots : slots.filter((slot) => String(slot.status || '').toLowerCase() === slotFilter);

  const groupedSlots = filteredSlots.reduce((acc, slot) => {
    const key = new Date(slot.startAt).toISOString().slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  const orderedDays = Object.keys(groupedSlots).sort((a, b) => new Date(a) - new Date(b));

  const formatDayLabel = (isoDate) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const toKey = (value) => value.toISOString().slice(0, 10);
    const dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (toKey(date) === toKey(now)) return `Today - ${dateLabel}`;
    if (toKey(date) === toKey(tomorrow)) return `Tomorrow - ${dateLabel}`;
    return dateLabel;
  };

  return (
    <section className="doctor-slots-shell">
      <header className="doctor-slots-header">
        <h2 className="doctor-slots-title">Availability</h2>
        <p className="doctor-slots-sub">
          Manage your digital clinic presence, update slot windows, and keep consultations organized.
        </p>
      </header>

      {message ? <p className="doctor-slots-flash">{message}</p> : null}

      <div className="doctor-slots-grid">
        <div className="doctor-slots-left">
          <section className="doctor-status-card">
            <div className="doctor-status-top">
              <div>
                <h3>Clinic Status</h3>
                <div className="doctor-status-indicator">
                  <span className={`doctor-status-dot ${data?.callState === 'online' ? 'live' : 'idle'}`} aria-hidden="true" />
                  <span>{data?.callState === 'online' ? 'Currently Online' : 'Currently Offline'}</span>
                </div>
              </div>
              <div className="doctor-status-icon" aria-hidden="true">
                <span className="material-symbols-outlined">
                  {data?.callState === 'online' ? 'cloud_done' : 'cloud_off'}
                </span>
              </div>
            </div>

            <div className="doctor-status-actions">
              <button type="button" className="doctor-go-online" onClick={() => setCallState('online')}>
                <span className="material-symbols-outlined" aria-hidden="true">bolt</span>
                Go Online
              </button>
              <button type="button" className="doctor-go-offline" onClick={() => setCallState('offline')}>
                <span className="material-symbols-outlined" aria-hidden="true">power_settings_new</span>
                Go Offline
              </button>
            </div>
          </section>

          <section className="doctor-bulk-card">
            <h3>Bulk Schedule Update</h3>
            <form className="doctor-bulk-form" onSubmit={bulkUpdate}>
              <label>
                Select Date
                <input
                  type="date"
                  value={bulkForm.date}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, date: e.target.value }))}
                  required
                />
              </label>

              <div className="doctor-bulk-time-grid">
                <label>
                  Start Hour (UTC)
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={bulkForm.startHourUtc}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, startHourUtc: e.target.value }))}
                  />
                </label>

                <label>
                  End Hour (UTC)
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={bulkForm.endHourUtc}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, endHourUtc: e.target.value }))}
                  />
                </label>
              </div>

              <label>
                Action Type
                <select
                  value={bulkForm.action}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, action: e.target.value }))}
                >
                  <option value="make_available">Make Available</option>
                  <option value="make_busy">Make Busy</option>
                </select>
              </label>

              <button type="submit" className="doctor-bulk-submit">Apply Changes</button>
            </form>
          </section>
        </div>

        <section className="doctor-upcoming-card">
          <div className="doctor-upcoming-head">
            <h3>Upcoming Slots</h3>
            <div className="doctor-filter-wrap">
              <span className="material-symbols-outlined" aria-hidden="true">filter_list</span>
              <select value={slotFilter} onChange={(e) => setSlotFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="available">Available</option>
                <option value="booked">Booked</option>
                <option value="busy">Busy</option>
              </select>
            </div>
          </div>

          {filteredSlots.length === 0 ? <p className="journey-empty-note">No slots found for this filter.</p> : null}

          <div className="doctor-slot-list">
            {orderedDays.map((dayKey) => (
              <div key={dayKey} className="doctor-slot-day-group">
                <div className="doctor-slot-day-head">
                  <span>{formatDayLabel(dayKey)}</span>
                  <div aria-hidden="true" />
                </div>

                {groupedSlots[dayKey]
                  .slice()
                  .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
                  .map((slot) => {
                    const status = String(slot.status || 'unknown').toLowerCase();
                    return (
                      <article className={`doctor-slot-row ${status}`} key={slot.id}>
                        <div className="doctor-slot-main">
                          <div className="doctor-slot-icon" aria-hidden="true">
                            <span className="material-symbols-outlined">
                              {status === 'booked' ? 'person' : 'calendar_today'}
                            </span>
                          </div>
                          <div>
                            <p className="doctor-slot-time">{utcDateTime(slot.startAt).slice(11, 16)} UTC</p>
                            <p className="doctor-slot-meta">
                              {status === 'booked' ? 'Reserved consultation slot' : 'Open for booking'}
                            </p>
                          </div>
                        </div>

                        <span className={`doctor-slot-badge ${status}`}>{status}</span>
                      </article>
                    );
                  })}
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function DoctorAnalyticsPage() {
  const { data, error, loading } = useApiPage('/api/doctors/me/analytics');

  if (loading) return <p className="muted">Loading analytics...</p>;
  if (error) return <p className="error">{error}</p>;

  const dailySeries = data?.dailySeries || [];
  const statusCounts = data?.statusCounts || {};

  const maxCount = Math.max(1, ...dailySeries.map((entry) => entry.count || 0));
  const peakDay = dailySeries.reduce(
    (best, entry) => ((entry.count || 0) > (best.count || 0) ? entry : best),
    dailySeries[0] || { day: 'N/A', count: 0 }
  );

  const formatOrdinalDay = (isoDate) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    const day = date.getDate();
    const j = day % 10;
    const k = day % 100;
    let suffix = 'th';
    if (j === 1 && k !== 11) suffix = 'st';
    else if (j === 2 && k !== 12) suffix = 'nd';
    else if (j === 3 && k !== 13) suffix = 'rd';
    return `${day}${suffix}`;
  };

  const rangeLabel =
    dailySeries.length > 1
      ? `${new Date(dailySeries[0].day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(
          dailySeries[dailySeries.length - 1].day
        ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'Current week';

  return (
    <section className="doctor-analytics-shell">
      <header className="doctor-analytics-header">
        <h2 className="doctor-analytics-title">Doctor Analytics</h2>
        <p className="doctor-analytics-sub">Last 7 days activity snapshot.</p>
      </header>

      <section className="doctor-metric-grid">
        <article className="doctor-metric-card">
          <div className="doctor-metric-top">
            <span className="material-symbols-outlined" aria-hidden="true">event_note</span>
            <span className="doctor-metric-chip positive">Booked</span>
          </div>
          <strong>{statusCounts.booked || 0}</strong>
          <p>Booked</p>
        </article>

        <article className="doctor-metric-card highlight">
          <div className="doctor-metric-top">
            <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
            <span className="doctor-metric-chip">Optimal</span>
          </div>
          <strong>{statusCounts.completed || 0}</strong>
          <p>Completed</p>
        </article>

        <article className="doctor-metric-card">
          <div className="doctor-metric-top">
            <span className="material-symbols-outlined" aria-hidden="true">cancel</span>
            <span className="doctor-metric-chip warn">Monitor</span>
          </div>
          <strong>{statusCounts.cancelled || 0}</strong>
          <p>Cancelled</p>
        </article>

        <article className="doctor-metric-card">
          <div className="doctor-metric-top">
            <span className="material-symbols-outlined" aria-hidden="true">person_off</span>
            <span className="doctor-metric-chip danger">No-show</span>
          </div>
          <strong>{statusCounts.no_show || 0}</strong>
          <p>No-show</p>
        </article>
      </section>

      <section className="doctor-chart-card">
        <div className="doctor-chart-head">
          <div>
            <h3>Daily Appointments</h3>
            <p>Frequency of patient consultations over the past week.</p>
          </div>
          <div className="doctor-chart-range">
            <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
            <span>{rangeLabel}</span>
          </div>
        </div>

        <div className="doctor-bar-chart" role="img" aria-label="Daily appointments bar chart">
          {dailySeries.map((entry) => {
            const heightPct = Math.max(6, Math.round(((entry.count || 0) / maxCount) * 100));
            const isPeak = entry.day === peakDay.day;
            return (
              <div className="doctor-bar-col" key={entry.day}>
                <span className="doctor-bar-value">{entry.count}</span>
                <div className={`doctor-bar ${isPeak ? 'peak' : ''}`} style={{ height: `${heightPct}%` }} />
                <span className={`doctor-bar-label ${isPeak ? 'peak' : ''}`}>{formatOrdinalDay(entry.day)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="doctor-insights-grid">
        <article className="doctor-insight-main">
          <h3>Patient Engagement Growth</h3>
          <p>
            Peak consultation volume was on {formatOrdinalDay(peakDay.day)} with {peakDay.count} appointments.
            Consistent completion trends suggest your current slot cadence is working well.
          </p>
          <a className="journey-cta secondary" href="#" onClick={(event) => event.preventDefault()}>
            Download Report
          </a>
        </article>

        <article className="doctor-insight-alert">
          <h3>Action Alert</h3>
          <p>
            {statusCounts.cancelled || 0} consultations were cancelled this week. Consider enabling reminder nudges to
            reduce drop-offs.
          </p>
          <a className="doctor-insight-link" href="#" onClick={(event) => event.preventDefault()}>
            Manage Reminders
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </a>
        </article>
      </section>
    </section>
  );
}

export default App;
