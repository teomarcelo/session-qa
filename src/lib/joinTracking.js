/**
 * Join tracking — records that an anonymous student opened a session, so usage
 * telemetry can measure attendance and participation (joined vs. asked/voted),
 * not just the students who happened to post.
 *
 * Firestore shape (see `match /joins/{uid}` in firestore.rules):
 *   sessions/{code}/joins/{anonymousUid} = { at: <server timestamp> }
 * Nothing else is stored: no name, no localStorage id, no device info.
 *
 * Behaviour:
 *   - At most ONE successful write per browser per session: a localStorage flag
 *     short-circuits every later page load. The rules also make the document
 *     create-only, so a repeat write can never move the first-join time.
 *   - Only anonymous identities are recorded. An instructor's "Student view"
 *     preview runs under their Google identity and is skipped, so instructors
 *     never inflate attendance.
 *   - Fire-and-forget. A failure (offline, rules not deployed yet, doc already
 *     exists) is logged at debug level and NEVER surfaces to the student or
 *     blocks joining. No flag is set on failure, so it retries on next load.
 *
 * This module has no Firebase imports so it can be unit-tested under node;
 * the student hook injects the real dependencies.
 */

const FLAG_PREFIX = 'sqa_joined_';

/** localStorage key for "this browser already recorded a join for this code". */
export function joinFlagKey(sessionCode) {
  return FLAG_PREFIX + String(sessionCode || '').replace(/[^A-Z0-9_-]/gi, '');
}

/**
 * Build a recorder bound to its dependencies.
 *
 * @param {object} deps
 * @param {() => Promise<object|null>} deps.ensureUser   resolves the Firebase user (anonymous sign-in)
 * @param {() => unknown} deps.serverTimestamp           Firestore server-timestamp sentinel
 * @param {{getItem(k:string):string|null, setItem(k:string,v:string):void}} [deps.storage]
 * @param {(msg:string, err?:unknown) => void} [deps.log]
 * @returns {(db: object, sessionCode: string) => Promise<'recorded'|'skipped'|'failed'>}
 */
export function createJoinRecorder({ ensureUser, serverTimestamp, storage, log = () => {} }) {
  const safeGet = (k) => { try { return storage ? storage.getItem(k) : null; } catch { return null; } };
  const safeSet = (k, v) => { try { if (storage) storage.setItem(k, v); } catch { /* private mode */ } };
  const inFlight = new Set();

  return async function recordJoin(db, sessionCode) {
    if (!db || !sessionCode) return 'skipped';
    const key = joinFlagKey(sessionCode);
    if (inFlight.has(key)) return 'skipped';
    inFlight.add(key);
    try {
      const user = await ensureUser();
      // Instructors (Google identity) and "auth unavailable" are not attendees.
      if (!user || !user.isAnonymous || !user.uid) return 'skipped';
      // The flag stores the uid it was recorded for: a new anonymous identity
      // in the same browser (auth storage cleared) is still counted.
      if (safeGet(key) === user.uid) return 'skipped';

      // Firestore write: create-only per the rules; doc id must equal the uid.
      await db
        .collection('sessions')
        .doc(sessionCode)
        .collection('joins')
        .doc(user.uid)
        .set({ at: serverTimestamp() });

      safeSet(key, user.uid);
      return 'recorded';
    } catch (err) {
      // permission-denied here is expected when the doc already exists (e.g.
      // localStorage was cleared) or before the rules are deployed. Never fatal.
      log('Join tracking skipped:', err && err.code ? err.code : err);
      return 'failed';
    } finally {
      inFlight.delete(key);
    }
  };
}
