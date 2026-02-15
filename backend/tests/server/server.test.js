// Mock dependencies before requiring anything
jest.mock('../../src/config', () => ({
  port: 0,
  nodeEnv: 'test',
  isProduction: false,
  isDevelopment: true,
  mongoUri: 'mongodb://localhost/test',
  jwtSecret: 'test-jwt-secret-key-minimum-length-32chars!',
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
  allowedOrigins: ['http://localhost:3000'],
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMax: 1000,
  firebase: {},
  stripeSecretKey: '',
  stripeWebhookSecret: '',
  paypalClientId: '',
  paypalClientSecret: '',
  paypalMode: 'sandbox',
}));

jest.mock('../../src/config/firebase.config', () => ({}));

// Mock mongoose connect to avoid real DB connection
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect: jest.fn().mockResolvedValue(true),
  };
});

const request = require('supertest');
const app = require('../../src/server');

describe('Server Health', () => {
  it('should respond to unknown routes with 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  it('should have CORS headers in responses', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('should have security headers from helmet', async () => {
    const res = await request(app).get('/api/products');
    // Helmet adds various security headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should reject oversized request bodies', async () => {
    const largeBody = { data: 'x'.repeat(3 * 1024 * 1024) }; // 3MB+ 
    const res = await request(app)
      .post('/api/auth/register')
      .send(largeBody);
    expect(res.status).toBe(413);
  });
});
