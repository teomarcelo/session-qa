import useInstructorStore from '../../store/useInstructorStore.js';
import { useSessions } from '../../hooks/useSessions.js';

export default function SessionsList() {
  const allSessions = useInstructorStore(s => s.allSessions);
  const activeSessionCode = useInstructorStore(s => s.activeSessionCode);
  const setActiveSessionCode = useInstructorStore(s => s.setActiveSessionCode);
  const isDemoMode = useInstructorStore(s => s.isDemoMode);
  const setJoinSessionModalOpen = useInstructorStore(s => s.setJoinSessionModalOpen);
  const setCreateSessionModalOpen = useInstructorStore(s => s.setCreateSessionModalOpen);
  const showToast = useInstructorStore(s => s.showToast);
  const { hideSession } = useSessions();

  const handleSelectSession = (code) => {
    setActiveSessionCode(code);
  };

  const handleHideSession = (e, code) => {
    e.preventDefault();
    e.stopPropagation();
    hideSession(code);
  };

  const handleJoin = () => {
    if (isDemoMode) {
      showToast('Exit demo mode to join real sessions.');
      return;
    }
    setJoinSessionModalOpen(true);
  };

  const handleCreate = () => {
    if (isDemoMode) {
      showToast('Exit demo mode to create real sessions.');
      return;
    }
    setCreateSessionModalOpen(true);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.9rem' }}>
        <button
          className="save-btn"
          style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1.5px solid var(--border)' }}
          onClick={handleJoin}
        >
          ↗ Join session
        </button>
        <button
          className="save-btn"
          style={{ background: 'var(--text)' }}
          onClick={handleCreate}
        >
          + New session
        </button>
      </div>

      <div id="sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {!allSessions.length ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', textAlign: 'center', padding: '0.75rem', lineHeight: 1.6 }}>
            No sessions in your list.<br/>
            Create one, join with a code, or un-hide by joining a hidden session again.
          </div>
        ) : (
          allSessions.map(s => {
            const active = activeSessionCode === s.id;
            return (
              <div key={s.id} className="session-list-row">
                <button
                  type="button"
                  className={`session-select-btn${active ? ' session-select-btn--active' : ''}`}
                  onClick={() => handleSelectSession(s.id)}
                >
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', letterSpacing: '0.08em' }}>
                    {s.id}
                  </div>
                  <div style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.sessionName || 'Untitled'}
                  </div>
                </button>
                <button
                  type="button"
                  className="session-hide-btn"
                  onClick={(e) => handleHideSession(e, s.id)}
                  title="Hide from your list"
                  aria-label="Hide session from list"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
