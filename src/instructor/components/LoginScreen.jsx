import { useState } from 'react';
import { useInstructorAuth } from '../hooks/useInstructorAuth.js';

export default function LoginScreen() {
  const [signinName, setSigninName] = useState('');
  const [signinPin, setSigninPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, enterDemo } = useInstructorAuth();

  const handleLogin = async () => {
    setLoginError('');
    setLoading(true);
    const err = await login(signinName, signinPin);
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
          <h1 className="login-title">Welcome back</h1>
          <p className="login-sub">Sign in with your instructor name and PIN.</p>
          <div className="field">
            <label>Your name</label>
            <input
              id="signin-name"
              type="text"
              placeholder="e.g. Alex Rivera"
              autoComplete="username"
              value={signinName}
              onChange={e => setSigninName(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Your PIN</label>
            <input
              id="signin-pin"
              type="password"
              placeholder="Enter your PIN"
              autoComplete="current-password"
              value={signinPin}
              onChange={e => setSigninPin(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
            />
          </div>
          <button className="btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          {loginError && <p className="error-msg">{loginError}</p>}
          <p style={{ textAlign: 'center', marginTop: '0.9rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            New instructor accounts are currently provisioned by an admin.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          </div>
          <DemoButton onClick={handleDemoMode} />
        </div>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-light)', textAlign: 'center' }}>
          🔒 Future upgrade: Restrict to <strong>@salesforce.com</strong> via Salesforce OAuth<br/>
          <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.8rem' }}>See setup instructions →</a>
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
