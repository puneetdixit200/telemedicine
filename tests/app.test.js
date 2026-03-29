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
    expect(res.body).toHaveProperty('requestId');
    expect(res.headers).toHaveProperty('x-request-id');
  });

  it('returns versioned session payload', async () => {
    const res = await request(app).get('/api/v1/session');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('user', null);
  });

  it('returns liveness payload', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      status: 'live'
    });
    expect(res.body).toHaveProperty('overallStatus', 'live');
    expect(res.body).toHaveProperty('checks.process.status', 'up');
  });

  it('returns readiness payload or service unavailable', async () => {
    const res = await request(app).get('/api/health/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('requestId');

    if (res.status === 200) {
      expect(res.body).toMatchObject({
        ok: true,
        status: 'ready'
      });
      expect(res.body).toHaveProperty('overallStatus', 'ready');
      expect(res.body).toHaveProperty('checks.database.status', 'up');
      expect(res.body).toHaveProperty('policy.fallback', 'serve_503_until_dependency_recovers');
      return;
    }

    expect(res.body).toMatchObject({
      ok: false,
      error: 'Service not ready',
      code: 'SERVICE_UNAVAILABLE',
      status: 'not_ready'
    });
    expect(['down', 'timeout']).toContain(res.body?.checks?.database?.status);
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
    expect(res.body).toMatchObject({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED'
    });
  });

  it('returns 401 for protected v1 API routes without auth', async () => {
    const res = await request(app).get('/api/v1/appointments');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED'
    });
  });
});
