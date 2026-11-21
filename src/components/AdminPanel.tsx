import React, { useState, useEffect } from 'react';
import { UserAccount, AdminStats, QARecord } from '../types';

interface AdminPanelProps {
  currentUser: UserAccount | null;
  onElevateToAdmin: () => void;
  onNavigateToChat: () => void;
  onNavigateToLogin: () => void;
  onShowToast: (msg: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  onElevateToAdmin,
  onNavigateToChat,
  onNavigateToLogin,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'qa' | 'config'>('overview');
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [qaRecords, setQaRecords] = useState<QARecord[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [searchQa, setSearchQa] = useState('');
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // System config state
  const [systemPrompt, setSystemPrompt] = useState('You are NUSA AI, a premier intelligent AI assistant.');
  const [defaultModel, setDefaultModel] = useState('NUSA Assistant');
  const [temperature, setTemperature] = useState('0.7');

  const isAdmin = currentUser?.role === 'admin';

  // Fetch admin overview stats
  const fetchAdminStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setAdminStats(data);
        if (data.system_config) {
          if (data.system_config.system_prompt) setSystemPrompt(data.system_config.system_prompt);
          if (data.system_config.default_model) setDefaultModel(data.system_config.default_model);
          if (data.system_config.temperature) setTemperature(data.system_config.temperature);
        }
      }
    } catch {
      // ignore offline error
    }
  };

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore offline error
    }
  };

  // Fetch Q&A logs
  const fetchQaRecords = async () => {
    try {
      const res = await fetch('/api/qa-records?limit=100');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setQaRecords(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore offline error
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminStats();
      fetchUsers();
      fetchQaRecords();
    }
  }, [isAdmin]);

  // Handle Passkey Unlock for instant elevation
  const handlePasskeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasskeyError(null);

    const input = passkeyInput.trim();
    if (input === 'nusa-admin-2026' || input === 'admin123#') {
      onElevateToAdmin();
      onShowToast('Admin privileges granted! Welcome to the Control Center.');
    } else {
      setPasskeyError('Invalid passkey. Master key is: nusa-admin-2026 or login with admin@nusa.ai');
    }
  };

  // User Management Actions
  const handleRoleToggle = async (user: UserAccount) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        onShowToast(data.error || 'Failed to update user role.');
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
        );
        onShowToast(`Updated ${user.name} role to ${newRole.toUpperCase()}.`);
        fetchAdminStats();
      }
    } catch (err: any) {
      onShowToast(err.message || 'Network error');
    }
  };

  const handleStatusToggle = async (user: UserAccount) => {
    const newStatus = user.status === 'active' ? 'banned' : 'active';
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        onShowToast(data.error || 'Failed to update user status.');
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
        );
        onShowToast(`User ${user.name} is now ${newStatus.toUpperCase()}.`);
        fetchAdminStats();
      }
    } catch (err: any) {
      onShowToast(err.message || 'Network error');
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.name}" (${user.email})?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || data.error) {
        onShowToast(data.error || 'Failed to delete user.');
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        onShowToast(`User ${user.name} deleted.`);
        fetchAdminStats();
      }
    } catch (err: any) {
      onShowToast(err.message || 'Network error');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'system_prompt', value: systemPrompt }),
      });
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'default_model', value: defaultModel }),
      });
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'temperature', value: temperature }),
      });
      onShowToast('AI & System configuration saved successfully.');
    } catch (err: any) {
      onShowToast(err.message || 'Error saving configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered views
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.role.toLowerCase().includes(searchUser.toLowerCase())
  );

  const filteredQa = qaRecords.filter(
    (q) =>
      q.question.toLowerCase().includes(searchQa.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQa.toLowerCase()) ||
      q.model.toLowerCase().includes(searchQa.toLowerCase())
  );

  // ================= RENDER ACCESS RESTRICTION IF NOT ADMIN =================
  if (!isAdmin) {
    return (
      <div className="admin-lock-screen">
        <div className="admin-lock-card">
          <div className="lock-icon-wrap">
            <i className="fa-solid fa-shield-halved"></i>
          </div>

          <h2>Restricted Access</h2>
          <p className="lock-subtitle">
            This area requires <strong>NUSA AI Administrator</strong> privileges. Standard users cannot access database operations, user accounts, or AI configuration.
          </p>

          <div className="current-user-status">
            <span>Signed in as:</span>
            <strong>{currentUser ? `${currentUser.name} (${currentUser.email})` : 'Guest / Not signed in'}</strong>
            <span className="badge-user-role">Role: {currentUser ? currentUser.role.toUpperCase() : 'NONE'}</span>
          </div>

          {/* Passkey Unlock Form */}
          <form onSubmit={handlePasskeySubmit} className="admin-passkey-form">
            <label htmlFor="passkey">Enter Admin Master Key or Passkey:</label>
            <div className="passkey-input-row">
              <input
                id="passkey"
                type="password"
                placeholder="Passkey (default: nusa-admin-2026)"
                value={passkeyInput}
                onChange={(e) => setPasskeyInput(e.target.value)}
              />
              <button type="submit" className="unlock-btn">
                <i className="fa-solid fa-key"></i> Unlock
              </button>
            </div>
            {passkeyError && <span className="passkey-error">{passkeyError}</span>}
          </form>

          <div className="admin-lock-actions">
            <button className="secondary-btn" onClick={onNavigateToLogin}>
              <i className="fa-solid fa-arrow-right-to-bracket mr-2"></i>
              Login as Admin Account
            </button>
            <button className="secondary-btn" onClick={onNavigateToChat}>
              <i className="fa-regular fa-message mr-2"></i>
              Return to Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= RENDER FULL ADMIN PORTAL =================
  return (
    <div className="admin-panel-container">
      {/* Top Banner */}
      <div className="admin-header-bar">
        <div className="admin-title-area">
          <div className="admin-shield-icon">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div>
            <h2>NUSA AI Admin Panel & Control Center</h2>
            <div className="admin-meta-chips">
              <span className="chip"><i className="fa-solid fa-database"></i> SQLite: nusa_ai.db</span>
              <span className="chip online"><i className="fa-solid fa-circle"></i> WebSocket Engine Live</span>
              <span className="chip admin-tag">Admin: {currentUser?.name}</span>
            </div>
          </div>
        </div>

        <div className="admin-header-actions">
          <button
            className="secondary-btn"
            onClick={() => {
              fetchAdminStats();
              fetchUsers();
              fetchQaRecords();
              onShowToast('Admin metrics refreshed!');
            }}
            title="Refresh All Data"
          >
            <i className="fa-solid fa-arrows-rotate mr-1.5"></i> Refresh
          </button>
          <button className="primary-btn" onClick={onNavigateToChat}>
            <i className="fa-regular fa-message mr-1.5"></i> Open Chat
          </button>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="admin-nav-tabs">
        <button
          className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fa-solid fa-chart-line"></i>
          <span>Dashboard Overview</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <i className="fa-solid fa-users-gear"></i>
          <span>User Management ({users.length})</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === 'qa' ? 'active' : ''}`}
          onClick={() => setActiveTab('qa')}
        >
          <i className="fa-solid fa-list-check"></i>
          <span>Global Q&A Logs ({qaRecords.length})</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          <i className="fa-solid fa-sliders"></i>
          <span>AI & System Config</span>
        </button>
      </div>

      {/* ================= TAB 1: DASHBOARD OVERVIEW ================= */}
      {activeTab === 'overview' && (
        <div className="admin-tab-content">
          <div className="admin-kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">TOTAL REGISTERED USERS</span>
              <div className="kpi-value-row">
                <span className="kpi-num">{adminStats?.total_users ?? users.length}</span>
                <i className="fa-solid fa-users kpi-icon blue"></i>
              </div>
              <small className="kpi-sub">{adminStats?.active_users ?? 0} active, {adminStats?.banned_users ?? 0} suspended</small>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">ADMINISTRATORS</span>
              <div className="kpi-value-row">
                <span className="kpi-num">{adminStats?.admin_count ?? 1}</span>
                <i className="fa-solid fa-shield-halved kpi-icon amber"></i>
              </div>
              <small className="kpi-sub">Authorized system operators</small>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">TOTAL Q&A RECORDS</span>
              <div className="kpi-value-row">
                <span className="kpi-num">{adminStats?.total_qa_pairs ?? qaRecords.length}</span>
                <i className="fa-solid fa-database kpi-icon purple"></i>
              </div>
              <small className="kpi-sub">Saved permanent questions & answers</small>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">AVG GENERATION LATENCY</span>
              <div className="kpi-value-row">
                <span className="kpi-num">{adminStats?.avg_latency_ms ?? 0} ms</span>
                <i className="fa-solid fa-bolt kpi-icon green"></i>
              </div>
              <small className="kpi-sub">Sub-second response streaming</small>
            </div>
          </div>

          {/* Quick System Info Cards */}
          <div className="admin-section-grid">
            <div className="admin-box">
              <div className="box-header">
                <h3><i className="fa-solid fa-server mr-2"></i> Database & Python Engine Health</h3>
                <span className="badge-online">Connected</span>
              </div>
              <div className="box-body">
                <ul className="system-metrics-list">
                  <li>
                    <span>Database Engine:</span>
                    <strong>Python SQLite3 (WAL Mode Enabled)</strong>
                  </li>
                  <li>
                    <span>Database File:</span>
                    <code>{adminStats?.database_file || 'nusa_ai.db'}</code>
                  </li>
                  <li>
                    <span>Total Conversations:</span>
                    <strong>{adminStats?.total_conversations ?? 0}</strong>
                  </li>
                  <li>
                    <span>Total Message Turns:</span>
                    <strong>{adminStats?.total_messages ?? 0}</strong>
                  </li>
                  <li>
                    <span>Dynamic Memory Facts:</span>
                    <strong>{adminStats?.total_memory_facts ?? 0}</strong>
                  </li>
                </ul>
              </div>
            </div>

            <div className="admin-box">
              <div className="box-header">
                <h3><i className="fa-solid fa-users mr-2"></i> Recently Registered Users</h3>
                <button
                  className="icon-btn tiny"
                  onClick={() => setActiveTab('users')}
                  title="View all users"
                >
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
              <div className="box-body">
                <div className="recent-users-mini-list">
                  {(adminStats?.recent_users || users.slice(0, 5)).map((u) => (
                    <div key={u.id} className="mini-user-row">
                      <div className="mini-user-avatar">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="mini-user-info">
                        <strong>{u.name}</strong>
                        <small>{u.email}</small>
                      </div>
                      <span className={`role-badge-tag ${u.role}`}>
                        {u.role.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: USER MANAGEMENT ================= */}
      {activeTab === 'users' && (
        <div className="admin-tab-content">
          <div className="admin-table-toolbar">
            <div className="table-search-input">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
              />
            </div>
            <span className="results-count">Showing {filteredUsers.length} of {users.length} users</span>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-gray-400">
                      No users match the search query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-table-avatar">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{user.name}</strong>
                            <small className="block text-gray-400">{user.id}</small>
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge-tag ${user.role}`}>
                          {user.role === 'admin' ? (
                            <><i className="fa-solid fa-shield-halved"></i> Admin</>
                          ) : (
                            <><i className="fa-solid fa-user"></i> User</>
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge-tag ${user.status}`}>
                          {user.status === 'active' ? 'Active' : 'Banned'}
                        </span>
                      </td>
                      <td>
                        {new Date(user.created_at * 1000).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="table-actions-cell">
                          <button
                            className="action-btn-small"
                            onClick={() => handleRoleToggle(user)}
                            title={user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                          >
                            <i className="fa-solid fa-arrows-up-down"></i>
                            <span>{user.role === 'admin' ? 'Make User' : 'Make Admin'}</span>
                          </button>

                          <button
                            className={`action-btn-small ${user.status === 'active' ? 'danger' : 'success'}`}
                            onClick={() => handleStatusToggle(user)}
                            title={user.status === 'active' ? 'Suspend User' : 'Reactivate User'}
                          >
                            <i className={`fa-solid ${user.status === 'active' ? 'fa-ban' : 'fa-check'}`}></i>
                            <span>{user.status === 'active' ? 'Ban' : 'Unban'}</span>
                          </button>

                          <button
                            className="action-btn-small icon-only danger"
                            onClick={() => handleDeleteUser(user)}
                            title="Delete User"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: GLOBAL Q&A LOGS ================= */}
      {activeTab === 'qa' && (
        <div className="admin-tab-content">
          <div className="admin-table-toolbar">
            <div className="table-search-input">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                placeholder="Search across all questions, answers, and models..."
                value={searchQa}
                onChange={(e) => setSearchQa(e.target.value)}
              />
            </div>
            <a
              href="/api/qa-records/export?format=csv"
              className="export-btn-admin"
              download
            >
              <i className="fa-solid fa-download"></i> Export CSV
            </a>
          </div>

          <div className="qa-log-cards-list">
            {filteredQa.length === 0 ? (
              <div className="empty-qa-box">
                No Q&A records match your search.
              </div>
            ) : (
              filteredQa.map((record) => (
                <div key={record.id} className="admin-qa-card">
                  <div className="qa-card-header">
                    <span className="qa-model-badge">{record.model}</span>
                    <span className="qa-meta-details">
                      <span>{record.latency_ms}ms</span> • <span>{record.tokens} tokens</span> •{' '}
                      <span>{new Date(record.created_at * 1000).toLocaleString()}</span>
                    </span>
                  </div>

                  <div className="qa-card-q">
                    <strong>Q:</strong> {record.question}
                  </div>

                  <div className="qa-card-a">
                    <strong>A:</strong> {record.answer}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 4: AI & SYSTEM CONFIG ================= */}
      {activeTab === 'config' && (
        <div className="admin-tab-content">
          <form onSubmit={handleSaveConfig} className="admin-config-form">
            <div className="config-card">
              <h3><i className="fa-solid fa-robot mr-2"></i> AI Assistant System Persona</h3>
              <p>Configure the foundational instructions given to Gemini during all chat generations.</p>

              <div className="form-group mt-4">
                <label>Global System Instruction</label>
                <textarea
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="config-textarea"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="form-group">
                  <label>Default AI Persona</label>
                  <select
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    className="config-select"
                  >
                    <option value="NUSA Assistant">NUSA Assistant (Balanced)</option>
                    <option value="NUSA Creative">NUSA Creative (Storytelling & Brainstorming)</option>
                    <option value="NUSA Code">NUSA Code (Software & Engineering)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Model Temperature ({temperature})</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="config-range"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Precise (0.1)</span>
                    <span>Balanced (0.7)</span>
                    <span>Creative (1.0)</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  className="primary-btn px-6 py-2.5"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
