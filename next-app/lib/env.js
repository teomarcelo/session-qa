/**
 * Fail fast at boot if any required env var is missing or obviously wrong.
 * Called once from the auth route handlers — not in middleware (which runs on
 * every request and shouldn't crash hard on missing vars during deploy checks).
 */

const REQUIRED = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SESSION_SECRET',
  'ALLOWED_DOMAIN',
  'APP_URL',
];

export function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Copy next-app/.env.example to next-app/.env.local and fill in values.`
    );
  }

  const secret = process.env.SESSION_SECRET;
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long.');
  }

  const appUrl = process.env.APP_URL;
  try {
    new URL(appUrl);
  } catch {
    throw new Error(`APP_URL is not a valid URL: "${appUrl}"`);
  }
}

export function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Environment variable ${name} is not set.`);
  return val;
}
