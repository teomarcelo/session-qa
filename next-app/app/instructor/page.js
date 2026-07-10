import '../globals.css';
import styles from './app.module.css';
import { getServerSession } from '../../lib/getServerSession.js';
import { requireEnv } from '../../lib/env.js';

/**
 * Instructor app page — served protected behind auth middleware.
 *
 * Phase 1 embeds the existing Vite-built instructor app in an iframe. The
 * authenticated Google identity (name + email) is passed to the iframe so the
 * instructor app can prefill the sign-in name instead of asking for a PIN.
 * Phase 2 will inline the React components directly.
 */
export default async function InstructorPage() {
  const user = await getServerSession();
  const viteOrigin = process.env.VITE_APP_ORIGIN ?? 'http://localhost:5173';
  const appUrl = requireEnv('APP_URL');

  const params = new URLSearchParams();
  if (user?.name) params.set('sso_name', user.name);
  if (user?.email) params.set('sso_email', user.email);
  // Absolute gateway logout URL so the iframe can navigate the top window to a real
  // sign-out (destroys the session cookie, then redirects to /login).
  params.set('sso_logout', `${appUrl}/api/auth/logout`);
  const qs = params.toString();
  const src = `${viteOrigin}/instructor.html${qs ? `?${qs}` : ''}`;

  return (
    <div className={styles.wrapper}>
      <iframe
        src={src}
        className={styles.frame}
        title="Session Q&A — Instructor"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
