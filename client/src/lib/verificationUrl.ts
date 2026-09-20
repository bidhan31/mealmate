/**
 * Extracts the raw verification token from a verification link.
 *
 * Used by the development bypass that allows an account to be verified without
 * an inbox when no mail provider is configured (the API returns the link in
 * that case, outside production only).
 */
export function tokenFromVerificationUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get('token');
  } catch {
    return null;
  }
}