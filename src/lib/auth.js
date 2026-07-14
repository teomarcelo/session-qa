/**
 * Firebase Auth helpers (compat SDK).
 *
 * Design goals:
 *  - Instructors sign in with Google, hinted to the salesforce.com workspace.
 *  - Students get a silent anonymous identity (no visible login) so their
 *    Firestore writes carry a stable uid the rules can key on.
 *  - Everything degrades gracefully: when Firebase is not configured (demo mode
 *    / no env), every helper is a safe no-op and never throws. Auth providers
 *    being disabled in the console surfaces as a clear error, never a crash.
 */
import firebase from './firebaseCompat.js';
import { FIREBASE_CONFIG } from '../config/firebase.js';

const SALESFORCE_HD = 'salesforce.com';

const configReady = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY');

/**
 * The compat Auth instance, or null when Firebase is not configured or the auth
 * component failed to load. Callers must treat null as "auth unavailable".
 */
export function getAuth() {
  if (!configReady) return null;
  try {
    return typeof firebase.auth === 'function' ? firebase.auth() : null;
  } catch (e) {
    console.warn('firebase.auth() unavailable:', e && e.message ? e.message : e);
    return null;
  }
}

/** The current Firebase user (or null). Safe when auth is unavailable. */
export function currentUser() {
  const auth = getAuth();
  return auth ? auth.currentUser : null;
}

/** Current uid, or null. Convenience for stamping writes. */
export function currentUid() {
  const u = currentUser();
  return u ? u.uid : null;
}

let authReadyPromise = null;

/**
 * Resolves once the initial auth state has been determined (i.e. Firebase has
 * checked persisted credentials). Resolves with the user or null. In demo/no-config
 * mode it resolves immediately with null. Memoized so repeated callers share it.
 */
export function onAuthReady() {
  if (authReadyPromise) return authReadyPromise;
  const auth = getAuth();
  if (!auth) {
    authReadyPromise = Promise.resolve(null);
    return authReadyPromise;
  }
  authReadyPromise = new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged(
      (user) => { unsub(); resolve(user || null); },
      () => { unsub(); resolve(null); },
    );
  });
  return authReadyPromise;
}

/** Alias kept for readability at call sites that want to "await auth". */
export const waitForAuth = onAuthReady;

const SALESFORCE_EMAIL_RE = /^[^@]+@salesforce[.]com$/;

/**
 * True only for a live, verified salesforce.com instructor identity. This mirrors
 * the Firestore `isSalesforce()` rule client-side so we never issue a privileged
 * read/write with a null, anonymous, or unverified token (which the rules reject
 * with "Missing or insufficient permissions").
 *
 * NOTE: `user.emailVerified` maps to the `email_verified` token claim the rules
 * check; Google Workspace accounts return true.
 */
export function isVerifiedSalesforceUser(user) {
  if (!user || user.isAnonymous) return false;
  if (user.emailVerified !== true) return false;
  const email = user.email ? String(user.email).toLowerCase() : '';
  return SALESFORCE_EMAIL_RE.test(email);
}

/**
 * Await auth restoration, then return the current user only if it is a verified
 * salesforce.com instructor; otherwise null. Use this to gate instructor
 * privileged Firestore operations so they never race ahead of auth (post-refresh
 * currentUser === null) or run under an anonymous student session on the same
 * origin. In demo / no-config mode returns null (callers take the demo path).
 */
export async function ensureInstructorAuth() {
  const auth = getAuth();
  if (!auth) return null;
  await onAuthReady();
  const u = auth.currentUser;
  return isVerifiedSalesforceUser(u) ? u : null;
}

/**
 * Instructor sign-in with Google, hinted to the salesforce.com workspace.
 * Domain restriction is *enforced* by Firestore rules (verified salesforce.com
 * email); the `hd` param is only a UX hint for the account picker.
 *
 * Returns the signed-in firebase.User on success. Throws a friendly Error when
 * the provider is disabled, the popup is closed, or the domain hint is rejected.
 */
export async function signInInstructorWithGoogle() {
  const auth = getAuth();
  if (!auth) {
    throw new Error('Firebase is not configured. Use demo mode to explore the app.');
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  // Prefer the corporate account and skip the "choose account" cache when possible.
  provider.setCustomParameters({ hd: SALESFORCE_HD, prompt: 'select_account' });
  try {
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

/**
 * Silent anonymous sign-in for students. If a user is already present (anonymous
 * or otherwise) it is reused, so we never churn identities mid-session. Returns
 * the user, or null when auth is unavailable (demo mode still works offline).
 */
export async function ensureAnonymousStudent() {
  const auth = getAuth();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await auth.signInAnonymously();
    return cred.user;
  } catch (err) {
    // Anonymous provider may be disabled in the console. Don't break the app;
    // the write will fall back to its legacy localStorage id and (until strict
    // rules are enforced) still succeed.
    console.warn('Anonymous sign-in failed:', friendlyAuthError(err));
    return null;
  }
}

/** Sign the instructor out of Firebase. Safe no-op when auth is unavailable. */
export async function signOutInstructor() {
  const auth = getAuth();
  if (!auth) return;
  try {
    await auth.signOut();
  } catch (e) {
    console.warn('Sign-out failed:', e && e.message ? e.message : e);
  }
}

/** Map raw Firebase auth error codes to human-readable messages. */
function friendlyAuthError(err) {
  const code = err && err.code ? String(err.code) : '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this project yet. Enable it in the Firebase Console (Authentication → Sign-in method), or use demo mode.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in. Add it under Authentication → Settings → Authorized domains.';
    case 'auth/network-request-failed':
      return 'Network error during sign-in. Check your connection and try again.';
    default:
      return err && err.message ? err.message : 'Sign-in failed. Please try again.';
  }
}
