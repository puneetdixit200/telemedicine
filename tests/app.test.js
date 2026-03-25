const request = require('supertest');
const { createApp } = require('../app');

describe('basic routes', () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
    app = createApp();
  });

  it('redirects / to /dashboard', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });

  it('renders dashboard for anonymous user', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Dashboard');
    expect(res.text).toContain('login');
  });

  it('renders login page', async () => {
    const res = await request(app).get('/auth/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Login');
  });

  it('renders register page', async () => {
    const res = await request(app).get('/auth/register');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Register');
  });

  it('redirects unauthorized users to login for protected pages', async () => {
    const res = await request(app).get('/appointments');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/login');
  });
});
