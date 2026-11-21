import React, { useEffect, useState } from 'react';

interface WelcomeOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
  userName?: string;
  userEmail?: string;
  durationMs?: number;
}

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({
  isOpen,
  onComplete,
  userName,
  userEmail,
  durationMs = 2800,
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsFadingOut(false);
      return;
    }

    // Schedule fade-out ~400ms before completion
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, Math.max(800, durationMs - 450));

    // Complete and remove overlay
    const completeTimer = setTimeout(() => {
      onComplete();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [isOpen, durationMs, onComplete]);

  if (!isOpen) return null;

  return (
    <div
      className={`welcome-overlay-backdrop ${isFadingOut ? 'fade-out' : 'fade-in'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to NUSA AI"
      onClick={onComplete}
    >
      <div
        className="welcome-card-wrapper"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Traveling Gradient Perimeter Border */}
        <div className="perimeter-glow-border" aria-hidden="true" />
        
        {/* Main Card Content */}
        <div className="welcome-card-surface">
          {/* Official NUSA AI Logo */}
          <div className="welcome-logo-container">
            <img
              src="./logo.png"
              alt="NUSA AI Logo"
              className="welcome-logo-image"
              loading="eager"
            />
          </div>

          {/* Heading */}
          <h2 className="welcome-heading">Welcome to NUSA AI</h2>

          {/* Subtitle */}
          <p className="welcome-tagline">Your Intelligent AI Assistant</p>

          {/* User acknowledgment pill if user signed in */}
          {userName && (
            <div className="welcome-user-pill">
              <i className="fa-solid fa-circle-check"></i>
              <span>Signed in as <strong>{userName}</strong></span>
              {userEmail && <small>({userEmail})</small>}
            </div>
          )}

          {/* Subtle loading / entrance indicator */}
          <div className="welcome-progress-bar">
            <div
              className="welcome-progress-fill"
              style={{ animationDuration: `${durationMs}ms` }}
            />
          </div>

          <button
            className="welcome-skip-btn"
            onClick={onComplete}
            title="Continue to chat immediately"
          >
            <span>Entering Workspace</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};
