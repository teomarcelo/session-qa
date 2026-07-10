import { getSession } from './session.js';

/**
 * Read the session in a Server Component (App Router).
 * Returns the session user object, or null if not authenticated.
 */
export async function getServerSession() {
  try {
    const session = await getSession();
    return session?.user ?? null;
  } catch {
    return null;
  }
}
