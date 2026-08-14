/**
 * Single Firebase compat entry for the whole app (must match the `firebase` npm
 * package used by `sessionQuestionCounts.js` so modular `getApp()` / `getFirestore()`
 * see the same default app as `firebase.firestore()` from compat).
 */
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/app-check';
import { FIREBASE_CONFIG } from '../config/firebase.js';

const configReady = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY';
if (configReady && !firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

/**
 * App Check (reCAPTCHA v3) — env-guarded so the app never blocks on a missing key.
 *
 * - VITE_APPCHECK_SITE_KEY unset  → skip init entirely (dev-safe, demo-safe).
 * - VITE_APPCHECK_DEBUG set       → register the debug provider for localhost so
 *   development tokens are accepted (Firebase Console → App Check → debug tokens).
 *
 * App Check must be *initialized on the client* before it can be *enforced* in the
 * console. Enforcing on Firestore without a valid key would reject every write, so
 * we only enforce after the key is wired (see docs/qa-foundation.md).
 */
const APPCHECK_SITE_KEY = import.meta.env.VITE_APPCHECK_SITE_KEY || '';
if (configReady && APPCHECK_SITE_KEY) {
  try {
    // Debug token flow for local development only. Firebase reads this global
    // before activate() runs; the printed token is registered in the console.
    if (import.meta.env.VITE_APPCHECK_DEBUG) {
       
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    const appCheck = firebase.appCheck();
    appCheck.activate(
      new firebase.appCheck.ReCaptchaV3Provider(APPCHECK_SITE_KEY),
      /* isTokenAutoRefreshEnabled */ true,
    );
  } catch (e) {
    // Never let App Check init crash the app (e.g. key typo, provider offline).
    console.warn('App Check init skipped:', e && e.message ? e.message : e);
  }
} else if (configReady) {
  // One-line notice so it is obvious App Check is inactive in this build.
  console.info('App Check disabled: VITE_APPCHECK_SITE_KEY not set.');
}

export default firebase;
