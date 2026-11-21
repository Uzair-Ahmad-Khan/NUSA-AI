import React from 'react';
import { Conversation, UserAccount } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: 'chat' | 'library' | 'login' | 'admin';
  setActiveView: (view: 'chat' | 'library' | 'login' | 'admin') => void;
  conversations: Conversation[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
  onClearAll: () => void;
  searchFilter: string;
  setSearchFilter: (query: string) => void;
  totalQACount: number;
  currentUser?: UserAccount | null;
  onOpenAuthModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeView,
  setActiveView,
  conversations,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClearAll,
  searchFilter,
  setSearchFilter,
  totalQACount,
  currentUser,
  onOpenAuthModal,
}) => {
  const filteredChats = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.last_message && c.last_message.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand Row with provided official NUSA AI Logo */}
        <div className="brand-row">
          <div className="brand-logo-wrap">
            <img
              src="./logo.png"
              alt="NUSA AI Logo"
              className="sidebar-brand-logo"
            />
          </div>
          <div className="brand-titles">
            <span className="brand-name">
              NUSA <span>AI</span>
            </span>
            <span className="brand-subtitle">Intelligent Assistant</span>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Mobile Quick Account / Sign In card */}
        <div className="sidebar-mobile-auth-card">
          {currentUser ? (
            <div
              className="mobile-auth-user"
              onClick={() => {
                setActiveView('login');
                onClose();
              }}
            >
              <div className="mobile-user-avatar">
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.name}
                    className="avatar-img-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  currentUser.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="mobile-user-info">
                <strong>{currentUser.name}</strong>
                <span className={`user-role-badge ${currentUser.role}`}>
                  {currentUser.role === 'admin' ? '🛡️ Admin' : '👤 User'}
                </span>
              </div>
              <i className="fa-solid fa-chevron-right mobile-arrow"></i>
            </div>
          ) : (
            <button
              className="mobile-auth-login-cta"
              onClick={() => {
                setActiveView('login');
                onClose();
              }}
            >
              <div className="cta-icon">
                <i className="fa-solid fa-arrow-right-to-bracket"></i>
              </div>
              <div className="cta-text">
                <strong>Sign In / Register</strong>
                <small>Sync chats & unlock memory</small>
              </div>
              <i className="fa-solid fa-chevron-right mobile-arrow"></i>
            </button>
          )}
        </div>

        <button className="new-chat-btn" onClick={onNewChat}>
          <i className="fa-solid fa-plus"></i>
          <span>New chat</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="sidebar-search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="search"
            placeholder="Search conversations"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
          <span className="search-shortcut">/</span>
        </div>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="workspace-nav">
          <button
            className={`nav-item ${activeView === 'chat' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('chat');
              onClose();
            }}
          >
            <i className="fa-regular fa-message"></i> Chat
          </button>
          <button
            className={`nav-item ${activeView === 'library' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('library');
              onClose();
            }}
          >
            <i className="fa-solid fa-database"></i> Q&A Data Hub
            <span className="nav-tag">{totalQACount} records</span>
          </button>
          <button
            className={`nav-item ${activeView === 'login' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('login');
              onClose();
            }}
          >
            <i className="fa-regular fa-user"></i> {currentUser ? 'My Account' : 'User Login'}
            {currentUser && (
              <span className={`nav-tag ${currentUser.role === 'admin' ? 'admin' : ''}`}>
                {currentUser.role.toUpperCase()}
              </span>
            )}
          </button>
          <button
            className={`nav-item admin-nav-btn ${activeView === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('admin');
              onClose();
            }}
          >
            <i className="fa-solid fa-shield-halved text-amber-400"></i> Admin Panel
            <span className="nav-tag admin-pill">RESTRICTED</span>
          </button>
        </nav>

        <div className="history-heading">
          <span>RECENT CHATS ({conversations.length})</span>
          {conversations.length > 0 && (
            <button
              className="icon-btn tiny"
              title="Clear all chat history"
              onClick={onClearAll}
            >
              <i className="fa-solid fa-trash-can"></i>
            </button>
          )}
        </div>

        <div className="chat-history">
          {filteredChats.length === 0 ? (
            <div className="history-empty">
              {searchFilter ? 'No matching conversations found.' : 'Your conversations will appear here.'}
            </div>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                className={`history-item ${chat.id === activeChatId && activeView === 'chat' ? 'active' : ''}`}
                onClick={() => {
                  onSelectChat(chat.id);
                  onClose();
                }}
                title={chat.title}
              >
                <i className="fa-regular fa-message"></i>
                <span className="history-title">{chat.title}</span>
                <span
                  className="history-delete"
                  onClick={(e) => onDeleteChat(chat.id, e)}
                  title="Delete conversation"
                >
                  <i className="fa-solid fa-xmark"></i>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon">
              <i className="fa-solid fa-bolt"></i>
            </div>
            <div>
              <strong>Python & SQLite Connected</strong>
              <p>Persistent memory & real-time WebSocket.</p>
            </div>
            <i className="fa-solid fa-database upgrade-arrow"></i>
          </div>

          {/* Profile row with User Login / Account navigation */}
          <button
            className="profile-row"
            onClick={() => {
              setActiveView('login');
              onClose();
            }}
            title={currentUser ? `Account: ${currentUser.name} (${currentUser.role || 'user'})` : 'Sign in / Account'}
          >
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.name}
                className="avatar-img-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="avatar">
                {currentUser ? currentUser.name.charAt(0).toUpperCase() : 'N'}
              </div>
            )}
            <div className="profile-text">
              <strong>{currentUser ? currentUser.name : 'NUSA Guest'}</strong>
              <span>{currentUser ? currentUser.email : 'Click to Sign in with Google'}</span>
            </div>
            {currentUser ? (
              <i className="fa-solid fa-circle-check profile-status-icon authenticated"></i>
            ) : (
              <i className="fa-brands fa-google profile-status-icon"></i>
            )}
          </button>
        </div>
      </aside>

      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />
    </>
  );
};
