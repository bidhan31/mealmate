import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  TZ: z.string().default('Asia/Dhaka'),
  CURRENCY: z.string().default('BDT'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),

  BREVO_API_KEY: z
    .string()
    .optional()
    .default('')
    .transform((v) => v.trim().replace(/^["']|["']$/g, '')),
  MAIL_FROM: z
    .string()
    .optional()
    .default('MealMate <no-reply@mealmate.app>')
    .transform((v) => v.trim().replace(/^["']|["']$/g, '')),

  /**
   * Which transport delivers mail: 'brevo' | 'smtp' | 'console'.
   * Unset → auto-detect: Brevo key first, then SMTP, otherwise console logging.
   */
  MAIL_PROVIDER: z
    .string()
    .optional()
    .default('')
    .transform((v) => v.trim().toLowerCase().replace(/^["']|["']$/g, '')),

  /** SMTP transport (e.g. Gmail: smtp.gmail.com, port 465, app password). */
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  /** 'true' → implicit TLS (usually port 465). Unset → inferred from the port. */
  SMTP_SECURE: z.string().optional().default(''),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),

  /**
   * Allow accounts with an unverified email address to log in.
   * Unset → `true` outside production (so a missing/blocked mail provider can
   * never lock developers out) and `false` in production (strict verification).
   */
  ALLOW_UNVERIFIED_LOGIN: z
    .string()
    .optional()
    .transform((v) =>
      v === undefined || v.trim() === '' ? undefined : v.trim().toLowerCase() === 'true',
    ),

  CLIENT_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

// Unverified accounts may sign in when explicitly enabled. The default keeps
// local development usable even when no mail provider is configured, while
// production stays strict (a verified email is required).
const allowUnverifiedLogin = data.ALLOW_UNVERIFIED_LOGIN ?? data.NODE_ENV !== 'production';

export const env = {
  ...data,
  isProd: data.NODE_ENV === 'production',
  isDev: data.NODE_ENV === 'development',
  isTest: data.NODE_ENV === 'test',
  allowUnverifiedLogin,
  corsOrigins: data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
};
