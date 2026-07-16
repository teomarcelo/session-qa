/**
 * StudentViewOverlay — full-screen overlay showing the student app view.
 *
 * Both live and demo modes now render the REAL student app in an iframe, so the
 * instructor sees a pixel-identical copy of what students see (correct CSS, real
 * components, real layout) rather than a hand-built re-creation.
 *
 *  - Live session: student.html?code=SQA-XXXX (auto-joins via useStudentSession).
 *  - Demo:         student.html?demo=1 (runs the student app against its in-memory
 *                  demo store — no Firestore, Storage, or Auth; see
 *                  src/student/demo/useStudentDemoStore.js).
 *
 * The overlay bar (Student view label, mode badge, Reset demo, Close) is the only
 * instructor chrome. "Reset demo" simply reloads the iframe, which re-seeds fresh
 * in-memory demo data — it does not touch the instructor store.
 */
import { useState } from 'react';
import useInstructorStore from '../store/useInstructorStore.js';

export default function StudentViewOverlay() {
  const studentViewOpen = useInstructorStore(s => s.studentViewOpen);
  const setStudentViewOpen = useInstructorStore(s => s.setStudentViewOpen);
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);

  // Bumped by "Reset demo" to remount the demo iframe with a fresh seed.
  const [demoReloadNonce, setDemoReloadNonce] = useState(0);

  if (!studentViewOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        background: '#f7f6f3',
      }}
    >
      {/* Instructor overlay bar */}
      <div style={{
        background: '#1a1814',
        color: '#fff',
        padding: '0 1.25rem',
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 20, height: 20, background: '#6a0dad', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span style={{ fontSize: '.82rem', fontWeight: 500 }}>Student view</span>
          {isDemoMode && (
            <span style={{ background: 'rgba(234,179,8,0.2)', color: '#fbbf24', fontSize: '.68rem', fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>
              Demo preview
            </span>
          )}
          {!isDemoMode && activeSessionCode && (
            <span style={{ background: 'rgba(0,112,210,0.25)', color: '#60a5fa', fontSize: '.68rem', fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>
              Live — {activeSessionCode}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDemoMode && (
            <button
              onClick={() => setDemoReloadNonce(n => n + 1)}
              title="Reload the demo student view with fresh data"
              style={{
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.45)',
                color: '#fbbf24',
                borderRadius: 6,
                padding: '3px 12px',
                fontFamily: 'inherit',
                fontSize: '.8rem',
                cursor: 'pointer',
              }}
            >
              ↺ Reset demo
            </button>
          )}
          <button
            onClick={() => setStudentViewOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: 6,
              padding: '3px 12px',
              fontFamily: 'inherit',
              fontSize: '.8rem',
              cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {isDemoMode ? (
          <DemoIframeView reloadNonce={demoReloadNonce} />
        ) : (
          <LiveStudentView sessionCode={activeSessionCode} />
        )}
      </div>
    </div>
  );
}

// ── Live session view ─────────────────────────────────────────────────────────
// student.html renders with its own CSS bundle, exactly as students see it.
// ?code= triggers auto-join via useStudentSession.
function LiveStudentView({ sessionCode }) {
  const src = `./student.html?code=${encodeURIComponent(sessionCode)}`;
  return (
    <iframe
      src={src}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      title="Student view"
    />
  );
}

// ── Demo view ─────────────────────────────────────────────────────────────────
// Real student app in demo mode (?demo=1). The `key` remounts the iframe on
// "Reset demo" so it reloads and re-seeds fresh in-memory demo data; the query
// nonce also busts any cache. The student demo never touches Firestore/Storage/Auth.
function DemoIframeView({ reloadNonce }) {
  const src = `./student.html?demo=1${reloadNonce ? `&r=${reloadNonce}` : ''}`;
  return (
    <iframe
      key={reloadNonce}
      src={src}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      title="Student view (demo)"
    />
  );
}
