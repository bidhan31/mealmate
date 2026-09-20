process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mealmate_test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_access_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret';

// Keep mail delivery hermetic: tests must never talk to a real mail provider.
// `src/config/env.ts` runs dotenv.config() when imported, which would otherwise
// pull a real BREVO_API_KEY / SMTP_* from server/.env. dotenv does not override
// values already present in process.env, so pre-setting them to empty strings
// forces the console fallback the mail tests rely on (resolveMailProvider()
// → 'console', sendMail() → { delivered: false, skipped: true }).
process.env.MAIL_PROVIDER = '';
process.env.BREVO_API_KEY = '';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

