import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';

describe('GET /health', () => {
  it('reports the service as up', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('echoes a request id header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});

describe('POST /api/deconstruct validation', () => {
  it('rejects a problem that is too short', async () => {
    const res = await request(app).post('/api/deconstruct').send({ problem: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 3 characters/i);
  });

  it('rejects a missing problem', async () => {
    const res = await request(app).post('/api/deconstruct').send({});
    expect(res.status).toBe(400);
  });

  it('rejects a malformed dueDate', async () => {
    const res = await request(app)
      .post('/api/deconstruct')
      .send({ problem: 'write a novel', dueDate: '01-02-2026' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/YYYY-MM-DD/i);
  });
});

describe('PATCH /api/item/:itemId validation', () => {
  it('rejects an invalid status', async () => {
    const res = await request(app).patch('/api/item/1').send({ status: 'nope' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-numeric item id', async () => {
    const res = await request(app).patch('/api/item/abc').send({ status: 'done' });
    expect(res.status).toBe(400);
  });
});

describe('unknown routes', () => {
  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found.');
  });
});
