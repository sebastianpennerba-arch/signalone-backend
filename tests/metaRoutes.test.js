// ============================================================
// Meta Routes - Unit Tests
// Run with: npm test
// ============================================================

const request = require('supertest');
const express = require('express');
const metaRoutes = require('../metaRoutes');

// Mock app
const app = express();
app.use(express.json());
app.use('/api/meta', metaRoutes);

describe('Meta Routes', () => {
  
  describe('POST /api/meta/oauth/token', () => {
    it('should return 400 if code is missing', async () => {
      const response = await request(app)
        .post('/api/meta/oauth/token')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toContain('code');
    });
    
    it('should return 500 if env vars not set', async () => {
      delete process.env.META_APP_ID;
      
      const response = await request(app)
        .post('/api/meta/oauth/token')
        .send({ code: 'test_code' });
      
      expect(response.status).toBe(500);
    });
  });
  
  describe('POST /api/meta/me', () => {
    it('should return 400 if accessToken is missing', async () => {
      const response = await request(app)
        .post('/api/meta/me')
        .send({});
      
      expect(response.status).not.toBe(200);
    });
  });
  
  // Add more tests...
});
