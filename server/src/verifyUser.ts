import { connectDB, disconnectDB } from './config/db';
import { User } from './modules/users/user.model';
import { Token } from './modules/auth/token.model';

/**
 * Admin recovery tool: marks accounts as email-verified without needing the
 * verification email. Use it to unblock existing accounts when a mail provider
 * outage (or an unverified Brevo sender) prevented delivery.
 *
 * Usage: npm --workspace server run verify:user -- user@example.com [other@example.com]
 */
async function verifyUsers(): Promise<void> {
  const emails = process.argv
    .slice(2)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error('Usage: npm --workspace server run verify:user -- <email> [<email> ...]');
    process.exit(1);
  }

  await connectDB();

  for (const email of emails) {
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`✗ ${email} — no account found`);
      continue;
    }
    if (user.emailVerified) {
      console.log(`= ${email} — already verified`);
      continue;
    }

    user.emailVerified = true;
    await user.save();
    // Outstanding verification links are no longer needed.
    await Token.deleteMany({ userId: user._id, type: 'email_verify' });
    console.log(`✓ ${email} — marked as verified`);
  }

  await disconnectDB();
}

verifyUsers().catch((err) => {
  console.error('verify:user failed:', err);
  process.exit(1);
});