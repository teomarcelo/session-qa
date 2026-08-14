import styles from './hub.module.css';
import { getServerSession } from '../lib/getServerSession.js';

export default async function HubPage() {
  const user = await getServerSession();

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Session Q&amp;A</h1>
        {user && (
          <p className={styles.greeting}>
            Signed in as <strong>{user.email}</strong>
          </p>
        )}
        <nav className={styles.links}>
          <a className={styles.primary} href="/student">
            Student — join a session
          </a>
          <a className={styles.secondary} href="/instructor">
            Instructor — host &amp; moderate
          </a>
        </nav>
        <div className={styles.footer}>
          <a href="/api/auth/logout" className={styles.logoutLink}>Sign out</a>
        </div>
      </div>
    </main>
  );
}
