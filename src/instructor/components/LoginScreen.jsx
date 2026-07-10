import { useState } from 'react';
import { useInstructorAuth } from '../hooks/useInstructorAuth.js';

/** Read the Google identity passed by the Next.js gateway via the iframe URL. */
function readSsoIdentity() {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      name: (p.get('sso_name') || '').trim(),
      email: (p.get('sso_email') || '').trim(),
    };
  } catch (e) {
    return { name: '', email: '' };
  }
}

export default function LoginScreen() {
  const [sso] = useState(readSsoIdentity);
  const [name, setName] = useState(sso.name);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const { continueAs, enterDemo } = useInstructorAuth();

  const handleContinue = async () => {
    setLoginError('');
    setLoading(true);
    const err = await continueAs(name, sso.email);
    setLoading(false);
    if (err) setLoginError(err);
  };

  const handleDemoMode = () => {
    enterDemo();
  };

  return (
    <div id="login-screen" style={{ display: 'flex' }}>
      <div className="login-card">
        <div className="login-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Instructor access
        </div>

        <div id="mode-signin">
          <h1 className="login-title">You're signed in</h1>
          {sso.email ? (
            <p className="login-sub">
              Verified with Google as <strong>{sso.email}</strong>. Confirm the name
              students will see, then continue.
            </p>
          ) : (
            <p className="login-sub">Enter the name you want to go by, then continue.</p>
          )}

          <div className="field">
            <label>Name students see</label>
            <input
              id="signin-name"
              type="text"
              placeholder="e.g. Alex Rivera"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleContinue(); }}
            />
            <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', margin: '0.4rem 0 0' }}>
              This is how you appear to students and how your sessions are grouped. You can change it.
            </p>
          </div>

          <button className="btn-primary" onClick={handleContinue} disabled={loading}>
            {loading ? 'Continuing…' : 'Continue'}
          </button>
          {loginError && <p className="error-msg">{loginError}</p>}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          </div>
          <DemoButton onClick={handleDemoMode} />
        </div>
      </div>
    </div>
  );
}

function DemoButton({ onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        marginTop: '0.75rem',
        padding: '0.75rem',
        background: 'var(--surface2)',
        border: `1.5px dashed ${hover ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'inherit',
        fontSize: '0.9rem',
        color: hover ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'all 0.15s',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      🧪 Try the demo
    </button>
  );
}
