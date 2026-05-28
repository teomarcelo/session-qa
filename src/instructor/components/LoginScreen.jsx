import { useState } from 'react';
import { useInstructorAuth } from '../hooks/useInstructorAuth.js';

export default function LoginScreen() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [signinName, setSigninName] = useState('');
  const [signinPin, setSigninPin] = useState('');
  const [regName, setRegName] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regPin2, setRegPin2] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register, enterDemo } = useInstructorAuth();

  const handleLogin = async () => {
    setLoginError('');
    setLoading(true);
    const err = await login(signinName, signinPin);
    setLoading(false);
    if (err) setLoginError(err);
  };

  const handleRegister = async () => {
    setRegisterError('');
    setLoading(true);
    const err = await register(regName, regPin, regPin2);
    setLoading(false);
    if (err) setRegisterError(err);
  };

  const handleDemoMode = () => {
    enterDemo();
  };

  const switchMode = (m) => {
    setMode(m);
    setLoginError('');
    setRegisterError('');
  };

  return (
    <div id="login-screen" style={{ display: 'flex' }}>
      <div className="login-card">
        <div className="login-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Instructor access
        </div>

        {mode === 'signin' && (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            </div>
            <DemoButton onClick={handleDemoMode} />
            <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              First time here?{' '}
              <button
                onClick={() => switchMode('register')}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontFamily: 'inherit', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
              >
                Create an account →
              </button>
            </p>
          </div>
        )}

        {mode === 'register' && (
          <div id="mode-register">
            <h1 className="login-title">Create your account</h1>
            <p className="login-sub">Set up your instructor profile. You'll use this name and PIN every time you sign in.</p>
            <div className="field">
              <label>Your name</label>
              <input
                id="reg-name"
                type="text"
                placeholder="e.g. Alex Rivera"
                autoComplete="username"
                value={regName}
                onChange={e => setRegName(e.target.value)}
              />
              <p className="hint">This is how you'll appear as the instructor on student boards.</p>
            </div>
            <div className="field">
              <label>Create a PIN</label>
              <input
                id="reg-pin"
                type="password"
                placeholder="Choose a PIN (min 4 characters)"
                autoComplete="new-password"
                value={regPin}
                onChange={e => setRegPin(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Confirm PIN</label>
              <input
                id="reg-pin2"
                type="password"
                placeholder="Repeat your PIN"
                autoComplete="new-password"
                value={regPin2}
                onChange={e => setRegPin2(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRegister(); }}
              />
            </div>
            <button className="btn-primary" onClick={handleRegister} disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
            {registerError && <p className="error-msg">{registerError}</p>}
            <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <button
                onClick={() => switchMode('signin')}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontFamily: 'inherit', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
              >
                Sign in →
              </button>
            </p>
          </div>
        )}

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
