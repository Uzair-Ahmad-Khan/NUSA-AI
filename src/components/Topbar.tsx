import React, { useState, useRef, useEffect } from 'react';
import { NusaModel } from '../types';

interface TopbarProps {
  onOpenSidebar: () => void;
  selectedModel: NusaModel;
  onSelectModel: (model: NusaModel) => void;
  wsStatus: 'connected' | 'connecting' | 'disconnected' | 'streaming';
  latencyMs?: number;
  memoryCount: number;
  onOpenMemoryModal: () => void;
  isLightMode: boolean;
  onToggleTheme: () => void;
  onShare: () => void;
  currentUser?: any;
  onOpenAuthModal?: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToLogin?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenSidebar,
  selectedModel,
  onSelectModel,
  wsStatus,
  latencyMs,
  memoryCount,
  onOpenMemoryModal,
  isLightMode,
  onToggleTheme,
  onShare,
  currentUser,
  onOpenAuthModal,
  onNavigateToAdmin,
  onNavigateToLogin,
}) => {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-btn menu-toggle"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
        >
          <i className="fa-solid fa-bars-staggered"></i>
        </button>

        <div className="model-picker-wrap" ref={menuRef}>
          <button
            className="model-picker"
            onClick={() => setModelMenuOpen(!modelMenuOpen)}
          >
            <span className="model-dot"></span>
            <span>{selectedModel}</span>
            <i className="fa-solid fa-chevron-down"></i>
          </button>

          {modelMenuOpen && (
            <div className="model-menu">
              <button
                className={`model-option ${selectedModel === 'NUSA Assistant' ? 'selected' : ''}`}
                onClick={() => {
                  onSelectModel('NUSA Assistant');
                  setModelMenuOpen(false);
                }}
              >
                <span className="option-icon">
                  <i className="fa-solid fa-sparkles"></i>
                </span>
                <span>
                  <strong>NUSA Assistant</strong>
                  <small>Balanced for everyday reasoning</small>
                </span>
                {selectedModel === 'NUSA Assistant' && (
                  <i className="fa-solid fa-check option-check"></i>
                )}
              </button>

              <button
                className={`model-option ${selectedModel === 'NUSA Creative' ? 'selected' : ''}`}
                onClick={() => {
                  onSelectModel('NUSA Creative');
                  setModelMenuOpen(false);
                }}
              >
                <span className="option-icon violet">
                  <i className="fa-regular fa-lightbulb"></i>
                </span>
                <span>
                  <strong>NUSA Creative</strong>
                  <small>Writing, storytelling & ideas</small>
                </span>
                {selectedModel === 'NUSA Creative' && (
                  <i className="fa-solid fa-check option-check"></i>
                )}
              </button>

              <button
                className={`model-option ${selectedModel === 'NUSA Code' ? 'selected' : ''}`}
                onClick={() => {
                  onSelectModel('NUSA Code');
                  setModelMenuOpen(false);
                }}
              >
                <span className="option-icon green">
                  <i className="fa-solid fa-code"></i>
                </span>
                <span>
                  <strong>NUSA Code</strong>
                  <small>Programming, algorithms & debugging</small>
                </span>
                {selectedModel === 'NUSA Code' && (
                  <i className="fa-solid fa-check option-check"></i>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="topbar-actions">
        {/* WebSocket Live Status */}
        <div
          className={`status-pill ${wsStatus === 'streaming' ? 'streaming' : ''}`}
          title={
            wsStatus === 'streaming'
              ? 'WebSocket Streaming active'
              : wsStatus === 'connected'
              ? `WebSocket Connected (${latencyMs || 0}ms)`
              : wsStatus === 'disconnected'
              ? 'Offline / Static Mode (No backend server connected)'
              : 'Connecting to WebSocket server...'
          }
        >
          <span
            className="indicator-dot"
            style={{
              backgroundColor:
                wsStatus === 'streaming'
                  ? '#71b8ff'
                  : wsStatus === 'connected'
                  ? '#86d9ae'
                  : '#f87171',
            }}
          ></span>
          <span className="status-text">
            {wsStatus === 'streaming'
              ? 'Streaming'
              : wsStatus === 'connected'
              ? 'Live'
              : wsStatus === 'disconnected'
              ? 'Static'
              : 'Connecting'}
          </span>
          {latencyMs ? (
            <span className="latency-text">({latencyMs}ms)</span>
          ) : null}
        </div>

        {/* Memory Management Inspector Button */}
        <button
          className="memory-btn"
          onClick={onOpenMemoryModal}
          title={`Conversation Memory Bank (${memoryCount} facts)`}
        >
          <i className="fa-solid fa-brain"></i>
          <span className="btn-text">Memory</span>
          <span className="memory-badge-count">{memoryCount}</span>
        </button>

        {/* Theme Toggle */}
        <button
          className="icon-btn theme-toggle-btn"
          onClick={onToggleTheme}
          title={isLightMode ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
          aria-label="Toggle Theme"
        >
          <i className={`fa-regular ${isLightMode ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>

        {/* Share Button */}
        <button className="share-btn" onClick={onShare} title="Share conversation">
          <i className="fa-solid fa-arrow-up-from-bracket"></i>
          <span className="btn-text">Share</span>
        </button>

        {/* Admin Panel Quick Access (if user is Admin) */}
        {currentUser?.role === 'admin' && onNavigateToAdmin && (
          <button
            className="admin-topbar-pill"
            onClick={onNavigateToAdmin}
            title="Open NUSA AI Admin Panel"
          >
            <i className="fa-solid fa-shield-halved text-amber-400"></i>
            <span className="btn-text">Admin</span>
          </button>
        )}

        {/* User Sign-in / Profile Button in Topbar (Always fully visible & prioritized) */}
        <button
          className={`google-auth-btn ${currentUser ? 'signed-in' : 'guest-prompt'}`}
          onClick={onNavigateToLogin || onOpenAuthModal}
          title={currentUser ? `Account: ${currentUser.name} (${currentUser.role || 'user'})` : 'Sign In to NUSA AI'}
        >
          {currentUser?.picture || currentUser?.avatar_url ? (
            <img
              src={currentUser.picture || currentUser.avatar_url}
              alt={currentUser.name}
              className="topbar-avatar-img"
              referrerPolicy="no-referrer"
            />
          ) : currentUser ? (
            <div className="topbar-avatar-initial">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          ) : (
            <i className="fa-regular fa-user auth-icon"></i>
          )}
          <span className="auth-btn-label">
            {currentUser ? currentUser.name.split(' ')[0] : 'Sign In'}
          </span>
        </button>
      </div>
    </header>
  );
};
