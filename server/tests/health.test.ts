import request from 'supertest';
import { createApp } from '../src/app';
import { updateHomeSchema } from '../src/modules/homes/home.validators';

describe('GET /api/health', () => {
  it('returns 200 with status up', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('up');
  });
});

describe('updateHomeSchema', () => {
  it('accepts and preserves descoAccountNo in home settings', () => {
    const parsed = updateHomeSchema.parse({ descoAccountNo: '1234567890123' });
    expect(parsed.descoAccountNo).toBe('1234567890123');
  });
});
