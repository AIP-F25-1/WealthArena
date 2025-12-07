import request from 'supertest';
import app from '../server';

// Mock database connection to avoid requiring actual DB
jest.mock('../config/db', () => ({
  getPool: jest.fn().mockRejectedValue(new Error('Database not available in tests'))
}));

describe('Health Check Endpoint', () => {
  it('should return 200 and health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('service', 'backend');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('database');
  });
});

