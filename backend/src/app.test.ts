import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const app = createApp();

describe('HTTP API', () => {
  it('returns a healthy status without a database request', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('rejects protected API requests without a bearer token', async () => {
    const response = await request(app).get('/api/employees');
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Unauthorized');
  });

  it('validates login payloads before querying the database', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'bad-email', password: '' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
  });
});
