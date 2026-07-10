import '../globals.css';
import styles from './app.module.css';

/**
 * Student app page — served protected behind auth middleware.
 *
 * Phase 1 embeds the existing Vite-built student app in an iframe.
 * This is the lowest-risk migration path: the existing app code is
 * unchanged; only the outer shell gains the auth gate.
 *
 * Phase 2 will inline the React components directly into this page.
 */
export default function StudentPage() {
  const viteOrigin = process.env.VITE_APP_ORIGIN ?? 'http://localhost:5173';
  return (
    <div className={styles.wrapper}>
      <iframe
        src={`${viteOrigin}/student.html`}
        className={styles.frame}
        title="Session Q&A — Student"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
