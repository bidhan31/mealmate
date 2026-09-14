import { z } from 'zod';

const emailSchema = z.string().trim().email();

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(10),
  name: z.string().min(2).max(80).optional(),
});

// ── App Lock schemas ─────────────────────────────────────────────────────────

/** PIN: 4–8 numeric digits only */
const pinSchema = z.string().min(4).max(8).regex(/^\d+$/, 'PIN must be numeric digits only');

export const setLockPinSchema = z.object({
  pin: pinSchema,
  timeoutMin: z.coerce.number().int().min(0).max(120).optional(),
});

export const unlockAppSchema = z.object({
  pin: pinSchema,
});

export const updateLockSettingsSchema = z.object({
  timeoutMin: z.coerce.number().int().min(0).max(120),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
