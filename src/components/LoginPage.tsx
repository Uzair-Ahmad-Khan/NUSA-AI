import React, { useState } from 'react';
import { UserAccount } from '../types';

interface LoginPageProps {
  currentUser: UserAccount | null;
  onLoginSuccess: (user: UserAccount) => void;
  onLogout: () => void;
  onNavigateToChat: () => void;
  onNavigateToAdmin: () => void;
  onShowToast: (msg: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  onLoginSuccess,
  onLogout,
  onNavigateToChat,
  onNavigateToAdmin,
  onShowToast,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const localFallbackAuth = (
    authMode: 'signin' | 'signup',
    userEmail: string,
    userPw: string,
    userName?: string
  ): { user?: UserAccount; error?: string } => {
    const cleanEmail = userEmail.trim().toLowerCase();
    if (authMode === 'signin') {
      if (cleanEmail === 'admin@nusa.ai' && userPw === 'admin123#') {
        return {
          user: {
            id: 'usr_admin_local',
            name: 'NUSA Master Admin',
            email: 'admin@nusa.ai',
            role: 'admin',
            status: 'active',
            created_at: Date.now() / 1000,
          },
        };
      }
      if (cleanEmail === 'user@nusa.ai' && userPw === 'user123#') {
        return {
          user: {
            id: 'usr_user_local',
            name: 'NUSA Demo User',
            email: 'user@nusa.ai',
            role: 'user',
            status: 'active',
            created_at: Date.now() / 1000,
          },
        };
      }
      try {
        const stored = JSON.parse(localStorage.getItem('nusa_local_accounts') || '[]');
        const found = Array.isArray(stored)
          ? stored.find((u: any) => u.email?.toLowerCase() === cleanEmail && u.password === userPw)
          : null;
        if (found) {
          const { password: _pw, ...safeUser } = found;
          return { user: safeUser };
        }
      } catch {
        // ignore storage parse issues
      }
      return { error: 'Invalid credentials. Try demo login or Create Account.' };
    }

    const newUser: UserAccount = {
      id: `usr_${Date.now()}`,
      name: (userName || cleanEmail.split('@')[0]).trim(),
      email: cleanEmail,
      role: cleanEmail === 'admin@nusa.ai' || cleanEmail === 'ahmaduzair1418@gmail.com' ? 'admin' : 'user',
      status: 'active',
      created_at: Date.now() / 1000,
    };
    try {
      const stored = JSON.parse(localStorage.getItem('nusa_local_accounts') || '[]');
      const list = Array.isArray(stored) ? stored : [];
      list.push({ ...newUser, password: userPw });
      localStorage.setItem('nusa_local_accounts', JSON.stringify(list));
    } catch {
      // ignore storage errors
    }
    return { user: newUser };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = mode === 'signin' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'signin' ? { email, password } : { name, email, password };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const fallback = localFallbackAuth(mode, email, password, name);
        if (fallback.error) {
          setErrorMsg(fallback.error);
        } else if (fallback.user) {
          onLoginSuccess(fallback.user);
          onShowToast(`Welcome, ${fallback.user.name}! (Static Mode)`);
        }
        return;
      }

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || (mode === 'signin' ? 'Failed to sign in.' : 'Failed to create account.'));
      } else {
        onLoginSuccess(data.user);
        onShowToast(
          mode === 'signin'
            ? `Welcome back, ${data.user.name}!`
            : `Account created successfully! Welcome, ${data.user.name}.`
        );
      }
    } catch {
      const fallback = localFallbackAuth(mode, email, password, name);
      if (fallback.error) {
        setErrorMsg(fallback.error);
      } else if (fallback.user) {
        onLoginSuccess(fallback.user);
        onShowToast(`Welcome, ${fallback.user.name}! (Offline Mode)`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPw: string) => {
    setEmail(demoEmail);
    setPassword(demoPw);
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPw }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const fallback = localFallbackAuth('signin', demoEmail, demoPw);
        if (fallback.user) {
          onLoginSuccess(fallback.user);
          onShowToast(`Signed in as ${fallback.user.role === 'admin' ? 'Administrator' : 'Standard User'}!`);
        }
        return;
      }

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Failed to sign in.');
      } else {
        onLoginSuccess(data.user);
        onShowToast(`Signed in as ${data.user.role === 'admin' ? 'Administrator' : 'Standard User'}!`);
      }
    } catch {
      const fallback = localFallbackAuth('signin', demoEmail, demoPw);
      if (fallback.user) {
        onLoginSuccess(fallback.user);
        onShowToast(`Signed in as ${fallback.user.role === 'admin' ? 'Administrator' : 'Standard User'}!`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-page-card">
        {/* NUSA AI Official Logo & Title */}
        <div className="login-header">
          <div className="login-logo-wrap">
            <img
              src="./logo.png"
              alt="NUSA AI Logo"
              className="login-logo-img"
            />
          </div>
          <h1 className="login-title">
            NUSA <span>AI</span>
          </h1>
          <p className="login-tagline">
            Your Intelligent AI Assistant with Secure Access & Workspace
          </p>
        </div>

        {currentUser ? (
          /* Profile Card if already authenticated */
          <div className="logged-in-profile-box">
            <div className="profile-badge-row">
              <span className={`role-pill ${currentUser.role === 'admin' ? 'admin' : 'user'}`}>
                {currentUser.role === 'admin' ? (
                  <>
                    <i className="fa-solid fa-shield-halved"></i> Master Administrator
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-user"></i> Standard User
                  </>
                )}
              </span>
              <span className="status-pill-badge active">
                <i className="fa-solid fa-circle"></i> Active Session
              </span>
            </div>

            <div className="profile-meta-card">
              <div className="profile-large-avatar">
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.name}
                    className="avatar-round"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  currentUser.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="profile-details">
                <h3>{currentUser.name}</h3>
                <p>{currentUser.email}</p>
                <small>User ID: {currentUser.id}</small>
              </div>
            </div>

            <div className="profile-actions-grid">
              <button
                className="primary-action-btn"
                onClick={onNavigateToChat}
              >
                <i className="fa-regular fa-message"></i> Go to Chat
              </button>

              {currentUser.role === 'admin' && (
                <button
                  className="admin-action-btn"
                  onClick={onNavigateToAdmin}
                >
                  <i className="fa-solid fa-shield-halved"></i> Open Admin Panel
                </button>
              )}

              <button
                className="signout-action-btn"
                onClick={onLogout}
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Login & Registration Form */
          <>
            {/* Tabs for Sign In vs Create Account */}
            <div className="auth-tab-selector">
              <button
                className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                }}
              >
                Sign In
              </button>
              <button
                className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
              >
                Create Account
              </button>
            </div>

            {errorMsg && (
              <div className="auth-error-callout" role="alert">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form-fields">
              {mode === 'signup' && (
                <div className="form-group">
                  <label htmlFor="reg-name">Full Name</label>
                  <div className="input-with-icon">
                    <i className="fa-regular fa-user"></i>
                    <input
                      id="reg-name"
                      type="text"
                      placeholder="e.g. Uzair Ahmad"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="auth-email">Email Address</label>
                <div className="input-with-icon">
                  <i className="fa-regular fa-envelope"></i>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="auth-password">Password</label>
                <div className="input-with-icon">
                  <i className="fa-solid fa-lock"></i>
                  <input
                    id="auth-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Authenticating...</span>
                  </>
                ) : mode === 'signin' ? (
                  <>
                    <i className="fa-solid fa-arrow-right-to-bracket"></i>
                    <span>Sign In to NUSA AI</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-user-plus"></i>
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Access Bar */}
            <div className="demo-credentials-section">
              <div className="demo-label">
                <span>QUICK 1-CLICK ACCESS</span>
              </div>
              <div className="demo-buttons-row">
                <button
                  type="button"
                  className="demo-card-btn admin"
                  onClick={() => handleQuickDemoLogin('admin@nusa.ai', 'admin123#')}
                  title="Log in as Administrator"
                >
                  <div className="demo-icon">
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <div className="demo-text">
                    <strong>Admin Panel Login</strong>
                    <small>admin@nusa.ai (Full Access)</small>
                  </div>
                </button>

                <button
                  type="button"
                  className="demo-card-btn user"
                  onClick={() => handleQuickDemoLogin('user@nusa.ai', 'user123#')}
                  title="Log in as Standard User"
                >
                  <div className="demo-icon">
                    <i className="fa-solid fa-user"></i>
                  </div>
                  <div className="demo-text">
                    <strong>Standard User Login</strong>
                    <small>user@nusa.ai (Regular Chat)</small>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
