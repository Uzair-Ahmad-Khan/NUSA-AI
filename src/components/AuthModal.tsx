import React, { useEffect, useState, useRef } from 'react';

export interface UserProfile {
  name: string;
  email: string;
  picture?: string;
  id?: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onLoginSuccess: (user: UserProfile) => void;
  onLogout: () => void;
  onTriggerWelcomePreview: () => void;
}

// Decode base64url JWT payload from Google Identity Services
function decodeJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse Google JWT token', e);
    return null;
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
  onTriggerWelcomePreview,
}) => {
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const [customClientId, setCustomClientId] = useState<string>(() => {
    return localStorage.getItem('nusa_google_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  });
  const [isConfiguringClientId, setIsConfiguringClientId] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const activeClientId = customClientId.trim() || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // Initialize GIS when modal opens and client ID is available
  useEffect(() => {
    if (!isOpen || currentUser) return;

    if (!activeClientId) {
      return;
    }

    const initGoogleIdentity = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        console.warn('Google Identity Services script not yet loaded');
        return;
      }

      try {
        google.accounts.id.initialize({
          client_id: activeClientId,
          callback: (response: any) => {
            if (response.credential) {
              const payload = decodeJwtPayload(response.credential);
              if (payload) {
                const user: UserProfile = {
                  name: payload.name || 'NUSA User',
                  email: payload.email || '',
                  picture: payload.picture,
                  id: payload.sub,
                };
                setAuthError(null);
                onLoginSuccess(user);
                onClose();
              } else {
                setAuthError('Could not decode Google user credentials.');
              }
            } else {
              setAuthError('Google authentication was cancelled or returned no credentials.');
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnContainerRef.current) {
          googleBtnContainerRef.current.innerHTML = '';
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            type: 'standard',
            theme: 'filled_blue',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 280,
            logo_alignment: 'left',
          });
        }
      } catch (err: any) {
        console.error('Error initializing Google GIS:', err);
        setAuthError(err?.message || 'Failed to initialize Google Sign-In.');
      }
    };

    // If script is ready, initialize directly, or poll for a moment
    if ((window as any).google?.accounts?.id) {
      initGoogleIdentity();
    } else {
      const timer = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(timer);
          initGoogleIdentity();
        }
      }, 200);
      return () => clearInterval(timer);
    }
  }, [isOpen, activeClientId, currentUser, onLoginSuccess, onClose]);

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    if (customClientId.trim()) {
      localStorage.setItem('nusa_google_client_id', customClientId.trim());
      setIsConfiguringClientId(false);
      setAuthError(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-kicker">GOOGLE AUTHENTICATION</div>
          <button className="icon-btn tiny" onClick={onClose} aria-label="Close modal">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Logo in Auth Modal */}
        <div className="auth-logo-row">
          <img
            src="./logo.png"
            alt="NUSA AI Logo"
            className="auth-modal-logo"
          />
          <div>
            <h2>NUSA AI</h2>
            <p className="auth-subtitle">Your Intelligent AI Assistant</p>
          </div>
        </div>

        {currentUser ? (
          /* User Profile View when signed in */
          <div className="auth-signed-in-view">
            <div className="signed-in-user-card">
              {currentUser.picture ? (
                <img
                  src={currentUser.picture}
                  alt={currentUser.name}
                  className="user-avatar-img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="avatar">{currentUser.name.charAt(0).toUpperCase()}</div>
              )}
              <div className="user-details">
                <strong>{currentUser.name}</strong>
                <span>{currentUser.email}</span>
                <span className="auth-status-badge">
                  <i className="fa-solid fa-circle-check"></i> Google Authenticated
                </span>
              </div>
            </div>

            <div className="auth-actions-group">
              <button
                className="secondary-btn flex items-center justify-center gap-2 w-full py-2.5"
                onClick={() => {
                  onClose();
                  onTriggerWelcomePreview();
                }}
              >
                <i className="fa-solid fa-wand-magic-sparkles text-cyan-400"></i>
                Replay Welcome Animation
              </button>
              <button
                className="secondary-btn w-full py-2.5 text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
              >
                <i className="fa-solid fa-arrow-right-from-bracket mr-2"></i>
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Sign-in Options */
          <div className="auth-login-view">
            <p className="auth-explainer">
              Sign in with your Google account to sync your conversation history, customize AI preferences, and access real-time WebSocket memory across devices.
            </p>

            {authError && (
              <div className="auth-error-banner">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{authError}</span>
              </div>
            )}

            {/* Google Official Button Container */}
            <div className="google-btn-wrapper">
              <div ref={googleBtnContainerRef} id="google-signin-btn" />
            </div>

            {/* Configuration requirement explanation (Rule #6 adherence) */}
            {!activeClientId && (
              <div className="oauth-config-notice">
                <div className="notice-header">
                  <i className="fa-solid fa-circle-info"></i>
                  <strong>Google OAuth Client ID Required</strong>
                </div>
                <p>
                  To complete actual Google authentication, supply your Google Cloud OAuth 2.0 Web Client ID in <code>.env.example</code> / <code>VITE_GOOGLE_CLIENT_ID</code> or enter it below:
                </p>

                {isConfiguringClientId ? (
                  <form onSubmit={handleSaveClientId} className="client-id-form">
                    <input
                      type="text"
                      placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                      value={customClientId}
                      onChange={(e) => setCustomClientId(e.target.value)}
                      className="client-id-input"
                    />
                    <div className="flex gap-2 mt-2">
                      <button type="submit" className="primary-btn text-xs py-1.5 px-3">
                        Save Client ID
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsConfiguringClientId(false)}
                        className="secondary-btn text-xs py-1.5 px-3"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="configure-id-btn"
                    onClick={() => setIsConfiguringClientId(true)}
                  >
                    <i className="fa-solid fa-gear"></i> Configure Google Client ID
                  </button>
                )}
              </div>
            )}

            {/* Test/Preview Welcome Animation Button */}
            <div className="welcome-preview-banner">
              <div className="preview-info">
                <strong>Test Welcome Experience</strong>
                <span>Preview the animated perimeter outline and welcome sequence</span>
              </div>
              <button
                className="preview-btn"
                onClick={() => {
                  onClose();
                  onTriggerWelcomePreview();
                }}
              >
                <i className="fa-solid fa-play"></i>
                Preview Animation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
