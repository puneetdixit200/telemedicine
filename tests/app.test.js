const request = require('supertest');
const { createApp } = require('../app');

describe('basic routes', () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
    app = createApp();
  });

  it('returns session payload', async () => {
    const res = await request(app).get('/api/session');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('user', null);
  });

  it('serves SPA entry for dashboard route', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root"></div>');
  });

  it('serves SPA entry for deep links', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root"></div>');
  });

  it('returns 401 for protected API routes without auth', async () => {
    const res = await request(app).get('/api/appointments');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});
