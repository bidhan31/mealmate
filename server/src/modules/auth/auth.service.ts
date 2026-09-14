import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import {
  passwordResetEmail,
  sendMail,
  verificationEmail,
} from '../../utils/mailer';
import { User, IUser } from '../users/user.model';
import { Token } from './token.model';
import {
  durationToMs,
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  signAccessToken,
  verifyPassword,
} from './auth.utils';

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

const EMAIL_VERIFY_TTL_MS = durationToMs('1d');
const PASSWORD_RESET_TTL_MS = durationToMs('1h');
const REFRESH_TTL_MS = durationToMs(env.JWT_REFRESH_TTL);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function publicUser(user: IUser) {
  // Convert the Mongoose Map to a plain Record for JSON serialisation
  const notificationPrefs: Record<string, boolean> = {};
  if (user.notificationPrefs) {
    for (const [k, v] of user.notificationPrefs.entries()) {
      notificationPrefs[k] = v;
    }
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? null,
    phone: user.phone ?? null,
    emailVerified: user.emailVerified,
    activeMembershipId: user.activeMembershipId ? user.activeMembershipId.toString() : null,
    // Lock state — returned to every client so any browser/device picks it up
    isAppLocked: user.isAppLocked,
    hasLockPin: !!user.lockPinHash,   // tells the client whether a PIN is set (without revealing it)
    lockTimeoutMin: user.lockTimeoutMin,
    // Notification preferences — sparse map of opted-out types (absent = opted-in)
    notificationPrefs,
  };
}

async function issueTokens(user: IUser): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({ sub: user._id.toString(), email: user.email });
  const { raw, hash } = generateOpaqueToken();
  await Token.create({
    userId: user._id,
    type: 'refresh',
    tokenHash: hash,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { accessToken, refreshToken: raw };
}

async function createEmailVerification(user: IUser): Promise<string> {
  await Token.deleteMany({ userId: user._id, type: 'email_verify' });
  const { raw, hash } = generateOpaqueToken();
  await Token.create({
    userId: user._id,
    type: 'email_verify',
    tokenHash: hash,
    expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
  });
  return `${env.CLIENT_URL}/verify-email?token=${raw}`;
}

export const authService = {
  async register(name: string, email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email: normalizedEmail, passwordHash, emailVerified: false });

    const link = await createEmailVerification(user);
    const mail = verificationEmail(user.name, link);
    await sendMail({ to: user.email, ...mail });

    return { user: publicUser(user) };
  },

  async verifyEmail(rawToken: string) {
    const tokenHash = hashOpaqueToken(rawToken);
    const record = await Token.findOne({ tokenHash, type: 'email_verify' });
    if (!record) throw ApiError.badRequest('Invalid or expired verification link');

    const user = await User.findById(record.userId);
    if (!user) throw ApiError.notFound('User not found');

    user.emailVerified = true;
    await user.save();
    await Token.deleteMany({ userId: user._id, type: 'email_verify' });

    return { user: publicUser(user) };
  },

  async resendVerification(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      throw ApiError.notFound('No account found with this email. Please sign up first.');
    }
    if (user.emailVerified) {
      throw ApiError.badRequest('This account is already verified. You can log in directly.');
    }

    const link = await createEmailVerification(user);
    const mail = verificationEmail(user.name, link);
    await sendMail({ to: user.email, ...mail });
    return { message: `Verification email sent to ${user.email}. Please check your inbox.` };
  },

  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user || !user.passwordHash) throw ApiError.unauthorized('Invalid email or password');

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw ApiError.unauthorized('Invalid email or password');

    if (!user.emailVerified) throw ApiError.forbidden('Please verify your email before logging in');

    const tokens = await issueTokens(user);
    return { user: publicUser(user), ...tokens };
  },

  async refresh(rawToken: string) {
    const tokenHash = hashOpaqueToken(rawToken);
    const record = await Token.findOne({ tokenHash, type: 'refresh' });
    if (!record) throw ApiError.unauthorized('Invalid refresh token');

    const user = await User.findById(record.userId);
    if (!user) throw ApiError.unauthorized('User not found');

    // Rotate: delete old refresh token, issue a new pair.
    await Token.deleteOne({ _id: record._id });
    const tokens = await issueTokens(user);
    return { user: publicUser(user), ...tokens };
  },

  async logout(rawToken: string) {
    const tokenHash = hashOpaqueToken(rawToken);
    await Token.deleteOne({ tokenHash, type: 'refresh' });
    return { message: 'Logged out' };
  },

  async forgotPassword(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      await Token.deleteMany({ userId: user._id, type: 'password_reset' });
      const { raw, hash } = generateOpaqueToken();
      await Token.create({
        userId: user._id,
        type: 'password_reset',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      });
      const link = `${env.CLIENT_URL}/reset-password?token=${raw}`;
      const mail = passwordResetEmail(user.name, link);
      await sendMail({ to: user.email, ...mail });
    }
    return { message: 'If an account exists, a password reset email has been sent.' };
  },

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = hashOpaqueToken(rawToken);
    const record = await Token.findOne({ tokenHash, type: 'password_reset' });
    if (!record) throw ApiError.badRequest('Invalid or expired reset link');

    const user = await User.findById(record.userId).select('+passwordHash');
    if (!user) throw ApiError.notFound('User not found');

    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await Token.deleteMany({ userId: user._id, type: { $in: ['password_reset', 'refresh'] } });

    return { message: 'Password has been reset. Please log in.' };
  },

  async googleAuth(idToken: string, nameOverride?: string) {
    if (!googleClient) throw ApiError.badRequest('Google login is not configured');

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw ApiError.unauthorized('Google account has no email');

    const normalizedEmail = normalizeEmail(payload.email);
    let user = await User.findOne({ email: normalizedEmail });
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      // Use user-provided name if given, otherwise fall back to Google name or email prefix
      const resolvedName = nameOverride?.trim() || payload.name || payload.email.split('@')[0];
      user = await User.create({
        name: resolvedName,
        email: normalizedEmail,
        avatar: payload.picture,
        googleId: payload.sub,
        emailVerified: true, // Google emails are pre-verified
      });
    } else if (!user.googleId) {
      // Linking existing email account to Google
      user.googleId = payload.sub;
      user.emailVerified = true;
      if (!user.avatar && payload.picture) user.avatar = payload.picture;
      // If a name override was provided, apply it
      if (nameOverride?.trim()) user.name = nameOverride.trim();
      await user.save();
    }

    const tokens = await issueTokens(user);
    // Signal whether the Google account needed a name prompt (name was derived from email)
    const needsName = isNewUser && !payload.name;
    return { user: publicUser(user), needsName, ...tokens };
  },

  async me(userId: string) {
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) throw ApiError.notFound('User not found');
    return { user: publicUser(user) };
  },

  async updateProfile(userId: string, updates: { name?: string; avatar?: string; phone?: string }) {
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) throw ApiError.notFound('User not found');
    if (updates.name !== undefined && updates.name.trim().length > 0) {
      user.name = updates.name.trim();
    }
    if (updates.avatar !== undefined) {
      user.avatar = updates.avatar;
    }
    if (updates.phone !== undefined) {
      user.phone = updates.phone.trim();
    }
    await user.save();
    return { user: publicUser(user) };
  },

  // ── App Lock ─────────────────────────────────────────────────────────────

  /** Set or update the lock PIN. Also enables the lock and re-fetches with lockPinHash. */
  async setLockPin(userId: string, pin: string, timeoutMin?: number) {
    const user = await User.findById(new Types.ObjectId(userId)).select('+lockPinHash');
    if (!user) throw ApiError.notFound('User not found');

    // Hash with bcrypt so it's safe even if the DB is compromised
    const lockPinHash = await bcrypt.hash(pin, 10);
    user.lockPinHash = lockPinHash;
    user.isAppLocked = false; // Don't lock immediately on PIN set
    if (timeoutMin !== undefined) user.lockTimeoutMin = timeoutMin;
    await user.save();

    return { user: publicUser(user) };
  },

  /** Remove the PIN and disable the lock entirely. */
  async removeLockPin(userId: string) {
    const user = await User.findById(new Types.ObjectId(userId)).select('+lockPinHash');
    if (!user) throw ApiError.notFound('User not found');

    user.lockPinHash = undefined;
    user.isAppLocked = false;
    await user.save();

    return { user: publicUser(user) };
  },

  /** Persist the lock (called when user clicks Lock or timeout fires). */
  async lockApp(userId: string) {
    const user = await User.findById(new Types.ObjectId(userId)).select('+lockPinHash');
    if (!user) throw ApiError.notFound('User not found');
    if (!user.lockPinHash) throw ApiError.badRequest('No lock PIN set — set a PIN first');

    user.isAppLocked = true;
    await user.save();

    return { user: publicUser(user) };
  },

  /** Verify PIN and unlock if correct. */
  async unlockApp(userId: string, pin: string) {
    const user = await User.findById(new Types.ObjectId(userId)).select('+lockPinHash');
    if (!user) throw ApiError.notFound('User not found');
    if (!user.lockPinHash) throw ApiError.badRequest('No lock PIN configured');

    const ok = await bcrypt.compare(pin, user.lockPinHash);
    if (!ok) throw ApiError.unauthorized('Incorrect PIN');

    user.isAppLocked = false;
    user.lockLastActive = new Date();
    await user.save();

    return { user: publicUser(user) };
  },

  /** Update lock settings (timeout) without changing PIN. */
  async updateLockSettings(userId: string, timeoutMin: number) {
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) throw ApiError.notFound('User not found');
    user.lockTimeoutMin = timeoutMin;
    user.lockLastActive = new Date();
    await user.save();
    return { user: publicUser(user) };
  },

  /** Update last-active timestamp (called periodically by the client). */
  async pingActivity(userId: string) {
    await User.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $set: { lockLastActive: new Date() } },
    );
    return { ok: true };
  },

  async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await User.findById(new Types.ObjectId(userId)).select('+passwordHash');
    if (!user) throw ApiError.notFound('User not found');
    if (!user.passwordHash) {
      throw ApiError.badRequest('Account uses OAuth login and does not have a local password set.');
    }
    const ok = await verifyPassword(currentPass, user.passwordHash);
    if (!ok) throw ApiError.unauthorized('Current password is incorrect');

    user.passwordHash = await hashPassword(newPass);
    await user.save();
    return { message: 'Password updated successfully' };
  },
};
