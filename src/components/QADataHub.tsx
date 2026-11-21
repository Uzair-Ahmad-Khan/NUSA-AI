import React, { useState, useEffect } from 'react';
import { QARecord, SystemStats } from '../types';
import { renderFormattedMarkdown } from '../utils/markdown';

interface QADataHubProps {
  stats: SystemStats | null;
  onOpenConversation: (conversationId: string) => void;
  onShowToast: (msg: string) => void;
}

export const QADataHub: React.FC<QADataHubProps> = ({
  stats,
  onOpenConversation,
  onShowToast,
}) => {
  const [records, setRecords] = useState<QARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modelFilter, setModelFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (modelFilter !== 'all') params.append('model', modelFilter);

      const res = await fetch(`/api/qa-records?${params.toString()}`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Backend unavailable');
      }
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      try {
        const local = JSON.parse(localStorage.getItem('nusa_local_qa') || '[]');
        const list: QARecord[] = Array.isArray(local) ? local : [];
        const filtered = list.filter((item) => {
          const matchesSearch =
            !searchTerm ||
            item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.answer.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesModel = modelFilter === 'all' || item.model === modelFilter;
          return matchesSearch && matchesModel;
        });
        setRecords(filtered);
      } catch {
        setRecords([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchRecords();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, modelFilter]);

  const handleExport = (format: 'json' | 'csv') => {
    if (records.length === 0) {
      window.location.href = `/api/qa-records/export?format=${format}`;
      onShowToast(`Downloading ${format.toUpperCase()} export...`);
      return;
    }
    const content =
      format === 'json'
        ? JSON.stringify(records, null, 2)
        : ['id,model,question,answer,latency_ms,tokens,created_at']
            .concat(
              records.map((r) =>
                [
                  r.id,
                  r.model,
                  `"${(r.question || '').replace(/"/g, '""')}"`,
                  `"${(r.answer || '').replace(/"/g, '""')}"`,
                  r.latency_ms,
                  r.tokens,
                  r.created_at,
                ].join(',')
              )
            )
            .join('\n');
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nusa_ai_qa.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`Downloaded ${format.toUpperCase()} export!`);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onShowToast(`${label} copied to clipboard!`);
  };

  return (
    <div className="chat-scroll">
      <div className="qa-hub-container">
        {/* Header */}
        <div className="qa-hub-header">
          <div className="qa-hub-title">
            <h2>NUSA AI Question-Answer Data Hub</h2>
            <p>
              Persistent archive of every prompt asked and answer generated, powered by Python SQLite.
            </p>
          </div>

          <div className="qa-hub-actions">
            <button
              className="export-btn"
              onClick={() => handleExport('csv')}
              title="Export all Q&A pairs as CSV"
            >
              <i className="fa-solid fa-file-csv"></i> Export CSV
            </button>
            <button
              className="export-btn"
              onClick={() => handleExport('json')}
              title="Export all Q&A pairs as JSON"
            >
              <i className="fa-solid fa-file-code"></i> Export JSON
            </button>
            <button
              className="export-btn"
              onClick={fetchRecords}
              title="Refresh records"
            >
              <i className="fa-solid fa-arrows-rotate"></i>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="qa-stats-grid">
          <div className="qa-stat-card">
            <div className="qa-stat-label">Total Questions Asked</div>
            <div className="qa-stat-value">{stats?.total_qa_pairs ?? records.length}</div>
          </div>
          <div className="qa-stat-card">
            <div className="qa-stat-label">Conversations Saved</div>
            <div className="qa-stat-value">{stats?.total_conversations ?? 0}</div>
          </div>
          <div className="qa-stat-card">
            <div className="qa-stat-label">Avg Response Latency</div>
            <div className="qa-stat-value">
              {stats?.avg_latency_ms ? `${stats.avg_latency_ms} ms` : '—'}
            </div>
          </div>
          <div className="qa-stat-card">
            <div className="qa-stat-label">Active Memory Facts</div>
            <div className="qa-stat-value" style={{ color: '#86d9ae' }}>
              {stats?.total_memory_facts ?? 0}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="qa-filters-bar">
          <div className="qa-search-box">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="search"
              placeholder="Search across questions, answers, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="qa-model-select"
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
          >
            <option value="all">All Models</option>
            <option value="NUSA Assistant">NUSA Assistant</option>
            <option value="NUSA Creative">NUSA Creative</option>
            <option value="NUSA Code">NUSA Code</option>
          </select>
        </div>

        {/* Q&A Records List */}
        {loading ? (
          <div className="text-center py-12 text-[#8b9ab7]">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-3 block text-[#71b8ff]"></i>
            Loading Q&A records from SQLite database...
          </div>
        ) : records.length === 0 ? (
          <div className="qa-empty-box text-center py-16 px-4 rounded-2xl border border-[rgba(160,177,207,0.1)] bg-[#11192e]">
            <i className="fa-regular fa-folder-open text-4xl mb-3 text-[#64748e]"></i>
            <h3 className="text-base font-semibold text-[#eaf2ff] mb-1">
              No Q&A Records Found
            </h3>
            <p className="text-sm text-[#8a9bb8] max-w-md mx-auto">
              Ask questions to NUSA AI in the chat to see real-time Q&A pairs recorded with latency, token metrics, and memory context here.
            </p>
          </div>
        ) : (
          <div className="qa-records-list">
            {records.map((item) => {
              const isExpanded = expandedId === item.id;
              const dateStr = new Date(item.created_at * 1000).toLocaleString();

              return (
                <div key={item.id} className="qa-record-card">
                  <div className="qa-record-meta">
                    <div className="flex items-center gap-2">
                      <span className="qa-badge">{item.model}</span>
                      {item.latency_ms > 0 && (
                        <span className="qa-badge" style={{ color: '#86d9ae', borderColor: 'rgba(134,217,174,0.3)' }}>
                          ⚡ {item.latency_ms} ms
                        </span>
                      )}
                      {item.tokens > 0 && (
                        <span className="qa-badge" style={{ color: '#dce6ff' }}>
                          ~{item.tokens} tokens
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="qa-time">{dateStr}</span>
                      <button
                        className="text-xs text-[#71b8ff] hover:underline"
                        onClick={() => onOpenConversation(item.conversation_id)}
                      >
                        Open Chat <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                      </button>
                    </div>
                  </div>

                  {/* Question */}
                  <div className="qa-question-box">
                    <span className="qa-label-tag">QUESTION</span>
                    <div className="qa-question-text">{item.question}</div>
                  </div>

                  {/* Answer */}
                  <div className="qa-answer-box">
                    <div className="flex items-center justify-between mb-2">
                      <span className="qa-label-tag !mb-0" style={{ color: '#82c9ff' }}>
                        ANSWER
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-[11px] text-[#7888a4] hover:text-[#eef3ff] flex items-center gap-1"
                          onClick={() => copyText(item.answer, 'Answer')}
                        >
                          <i className="fa-regular fa-copy"></i> Copy
                        </button>
                        <button
                          className="text-[11px] text-[#7888a4] hover:text-[#eef3ff] flex items-center gap-1"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          {isExpanded ? 'Show less' : 'Show full'}
                        </button>
                      </div>
                    </div>

                    <div
                      className="qa-answer-text"
                      style={{ maxHeight: isExpanded ? 'none' : '130px' }}
                    >
                      {renderFormattedMarkdown(item.answer, {
                        onCopyCode: (code) => copyText(code, 'Code'),
                      })}
                    </div>
                  </div>

                  {/* Memory Context Tag if present */}
                  {item.memory_context && item.memory_context.trim() && (
                    <div className="mt-3 text-[11px] text-[#869ab8] flex items-center gap-2">
                      <i className="fa-solid fa-brain text-[#86d9ae]"></i>
                      <span>Memory Context Injected During Response</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
