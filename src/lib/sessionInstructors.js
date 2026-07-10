/**
 * Derive the teaching roster for a session.
 *
 * Instructors are now automatic: the session owner (ownerName) is the lead, and
 * co-instructors are anyone who joined the session with its code (their display
 * name is added to the `instructors` array on join). We keep reading the legacy
 * `instructors` / `instructorNames` fields so older sessions still show correctly.
 *
 * @param {object} session - Firestore session doc (with id + fields).
 * @returns {{ lead: string, coInstructors: string[] }}
 */
export function getSessionInstructorRoster(session) {
  const s = session || {};

  const list = Array.isArray(s.instructors) && s.instructors.length
    ? s.instructors.map(n => String(n || '').trim()).filter(Boolean)
    : String(s.instructorNames || '')
        .split(',')
        .map(n => n.trim())
        .filter(Boolean);

  const lead = String(s.ownerName || '').trim() || list[0] || '';

  // Co-instructors = everyone in the roster except the lead, de-duped, order kept.
  const seen = new Set(lead ? [lead] : []);
  const coInstructors = [];
  list.forEach(n => {
    if (n && !seen.has(n)) {
      seen.add(n);
      coInstructors.push(n);
    }
  });

  return { lead, coInstructors };
}

/** Full ordered roster (lead first) as a flat list of names. */
export function getSessionInstructorNames(session) {
  const { lead, coInstructors } = getSessionInstructorRoster(session);
  return [lead, ...coInstructors].filter(Boolean);
}
