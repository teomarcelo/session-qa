/**
 * Firebase web client config. Override at build time with VITE_FIREBASE_* env vars.
 * Defaults match the bundled sample project documented in SETUP.md.
 */
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCM_fXpm_F2a4-h04m18UPy472UmDaa8OE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'tdx-qa.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tdx-qa',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'tdx-qa.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '964102376485',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:964102376485:web:bfa3d741284a1ef20f03cc',
};

/**
 * App Check reCAPTCHA v3 *site* key. Public by design — only the paired secret is
 * sensitive, and it stays in the Firebase Console.
 *
 * This ships as a committed default rather than living solely in an untracked
 * .env.local because production is built from a clean checkout of origin/main
 * (see .claude/skills/deploy-and-verify.md). That checkout has no .env.local, so an
 * env-only key resolves empty and the build silently ships with App Check inactive.
 */
export const APPCHECK_SITE_KEY =
  import.meta.env.VITE_APPCHECK_SITE_KEY || '6LdoE00tAAAAAKsgz6m-KlmXG6UkhnV4Myz15rwr';
