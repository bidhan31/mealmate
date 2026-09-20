import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { sendMail } from '../src/utils/mailer';

let mongoServer: MongoMemoryServer;
const app = createApp();

const EMAIL = 'resident@mealmate.test';
const PASSWORD = 'secret-pass-123';
const CREDENTIALS = { name: 'Resident', email: EMAIL, password: PASSWORD };

function tokenFromUrl(url: string): string {
  return new URL(url).searchParams.get('token') ?? '';
}

function register() {
  return request(app).post('/api/auth/register').send(CREDENTIALS);
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

describe('mailer without a configured provider', () => {
  it('reports the failure instead of throwing, so registration can never break', async () => {
    // server/.env has no BREVO_API_KEY in this environment
    const result = await sendMail({
      to: 'someone@example.com',
      subject: 'Test email',
      html: '<p>hello</p>',
      text: 'hello',
    });

    expect(result.delivered).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.error).toBeTruthy();
  });
});

describe('register → verify → login', () => {
  it('creates the account and returns a usable verification link when mail fails', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.data.user.emailVerified).toBe(false);
    expect(res.body.data.emailSent).toBe(false);
    expect(res.body.data.verificationUrl).toContain('/verify-email?token=');
    expect(res.body.message).toBeTruthy();
  });

  it('never leaves the user locked out: soft login works, then the link verifies the account', async () => {
    const registration = await register();
    const token = tokenFromUrl(registration.body.data.verificationUrl);

    // 1. Login is allowed before verification outside production
    const softLogin = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(softLogin.status).toBe(200);
    expect(softLogin.body.data.accessToken).toBeTruthy();
    expect(softLogin.body.data.user.emailVerified).toBe(false);

    // 2. Following the returned link verifies the account
    const verify = await request(app).post('/api/auth/verify-email').send({ token });
    expect(verify.status).toBe(200);
    expect(verify.body.data.user.emailVerified).toBe(true);

    // 3. Login now returns a verified user
    const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.emailVerified).toBe(true);

    // 4. Verification links are single-use
    const reuse = await request(app).post('/api/auth/verify-email').send({ token });
    expect(reuse.status).toBe(400);
  });

  it('blocks unverified login when ALLOW_UNVERIFIED_LOGIN is disabled (production behaviour)', async () => {
    await register();

    env.allowUnverifiedLogin = false;
    try {
      const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/verify your email/i);
    } finally {
      env.allowUnverifiedLogin = true;
    }
  });

  it('rejects a duplicate registration with 409', async () => {
    expect((await register()).status).toBe(201);
    expect((await register()).status).toBe(409);
  });
});

describe('resend verification', () => {
  it('returns a fresh link for an unverified account and refuses for a verified one', async () => {
    await register();

    const resend = await request(app).post('/api/auth/resend-verification').send({ email: EMAIL });
    expect(resend.status).toBe(200);
    expect(resend.body.data.verificationUrl).toContain('/verify-email?token=');

    const verify = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: tokenFromUrl(resend.body.data.verificationUrl) });
    expect(verify.status).toBe(200);

    const again = await request(app).post('/api/auth/resend-verification').send({ email: EMAIL });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already verified/i);
  });

  it('returns 404 for an unknown account', async () => {
    const res = await request(app).post('/api/auth/resend-verification').send({ email: 'nobody@mealmate.test' });
    expect(res.status).toBe(404);
  });
});

describe('forgot password', () => {
  it('does not fail with 500 when the mail provider cannot deliver', async () => {
    await register();
    const res = await request(app).post('/api/auth/forgot-password').send({ email: EMAIL });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset email has been sent/i);
  });
});