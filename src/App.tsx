import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Message, MemoryFact, NusaModel, SystemStats } from './types';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { WelcomeView } from './components/WelcomeView';
import { MessageList } from './components/MessageList';
import { Composer } from './components/Composer';
import { QADataHub } from './components/QADataHub';
import { MemoryModal } from './components/MemoryModal';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { AuthModal } from './components/AuthModal';
import { LoginPage } from './components/LoginPage';
import { AdminPanel } from './components/AdminPanel';
import { UserAccount } from './types';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeView, setActiveView] = useState<'chat' | 'library' | 'login' | 'admin'>('chat');
  const [selectedModel, setSelectedModel] = useState<NusaModel>('NUSA Assistant');
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [webResearch, setWebResearch] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [memoryFacts, setMemoryFacts] = useState<MemoryFact[]>([]);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'streaming'>('connecting');
  const [lastLatencyMs, setLastLatencyMs] = useState<number | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // User Authentication State & Welcome Overlay State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem('nusa_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const currentAssistantMsgIdRef = useRef<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = activeChatId;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  }, []);

  const backendAvailableRef = useRef<boolean | null>(null);

  const isJsonResponse = (res: Response) =>
    res.ok && (res.headers.get('content-type') || '').includes('application/json');

  // Fetch initial conversations and stats
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (isJsonResponse(res)) {
        backendAvailableRef.current = true;
        const data = await res.json();
        const list: Conversation[] = Array.isArray(data) ? data : [];
        setConversations(list);
        if (list.length > 0 && !activeChatIdRef.current) {
          setActiveChatId(list[0].id);
        }
        return;
      }
      backendAvailableRef.current = false;
    } catch {
      backendAvailableRef.current = false;
    }
    try {
      const local = JSON.parse(localStorage.getItem('nusa_local_conversations') || '[]');
      const list: Conversation[] = Array.isArray(local) ? local : [];
      setConversations(list);
      if (list.length > 0 && !activeChatIdRef.current) {
        setActiveChatId(list[0].id);
      }
    } catch {
      setConversations([]);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (isJsonResponse(res)) {
        const data = await res.json();
        setStats(data.stats || null);
      }
    } catch {
      // Static mode without backend
    }
  };

  const fetchMemory = async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/memory`);
      if (isJsonResponse(res)) {
        const data = await res.json();
        setMemoryFacts(Array.isArray(data.facts) ? data.facts : []);
        return;
      }
    } catch {
      // ignore offline
    }
    setMemoryFacts([]);
  };

  const fetchMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (isJsonResponse(res)) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
        return;
      }
    } catch {
      // ignore offline
    }
    try {
      const local = JSON.parse(localStorage.getItem(`nusa_local_messages_${convId}`) || '[]');
      setMessages(Array.isArray(local) ? local : []);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeChatId) {
      fetchMessages(activeChatId);
      fetchMemory(activeChatId);
    } else {
      setMessages([]);
      setMemoryFacts([]);
    }
  }, [activeChatId]);

  // Connect WebSocket
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let failedAttempts = 0;
    let hasConnectedOnce = false;
    let disposed = false;

    const connectWebSocket = () => {
      if (disposed) return;
      if (backendAvailableRef.current === false && failedAttempts >= 1) {
        setWsStatus('disconnected');
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/chat`;

      setWsStatus('connecting');
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        setWsStatus('disconnected');
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        failedAttempts = 0;
        hasConnectedOnce = true;
        backendAvailableRef.current = true;
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'handshake') {
            if (data.stats) setStats(data.stats);
          } else if (data.type === 'start') {
            setIsStreaming(true);
            setWsStatus('streaming');
            setStreamingText('');
            currentAssistantMsgIdRef.current = data.assistantMessageId;
          } else if (data.type === 'chunk') {
            setStreamingText((prev) => prev + data.text);
          } else if (data.type === 'done') {
            setIsStreaming(false);
            setWsStatus('connected');
            setLastLatencyMs(data.latencyMs);

            const newAssistantMsg: Message = {
              id: data.assistantMessageId || `asst-${Date.now()}`,
              conversation_id: data.conversationId,
              role: 'assistant',
              content: data.fullText,
              tokens: data.tokens,
              created_at: Date.now() / 1000,
            };

            setMessages((prev) => [...prev, newAssistantMsg]);
            setStreamingText('');

            if (data.extractedMemories && data.extractedMemories.length > 0) {
              showToast(`🧠 NUSA AI learned: ${data.extractedMemories[0].key.replace(/_/g, ' ')}`);
              fetchMemory(data.conversationId);
            }

            fetchConversations();
            fetchStats();
          } else if (data.type === 'memories_extracted') {
            if (data.extractedMemories && data.extractedMemories.length > 0) {
              const factName = data.extractedMemories[0].key.replace(/_/g, ' ');
              showToast(`🧠 NUSA AI learned: ${factName}`);
              fetchMemory(data.conversationId);
              fetchStats();
            }
          } else if (data.type === 'stopped') {
            setIsStreaming(false);
            setWsStatus('connected');
            showToast('Generation stopped.');
          } else if (data.type === 'error') {
            setIsStreaming(false);
            setWsStatus('connected');
            showToast(`Error: ${data.message}`);
          }
        } catch (e) {
          console.error('Error handling WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setWsStatus('disconnected');
        failedAttempts += 1;
        // Stop retrying if hosted statically with no WS server
        if (!hasConnectedOnce && failedAttempts >= 2) {
          return;
        }
        reconnectTimeout = setTimeout(connectWebSocket, Math.min(10000, 2000 * failedAttempts));
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      disposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [showToast]);

  // Scroll to bottom when messages update or streaming text arrives
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Handle creating a new chat
  const handleNewChat = async () => {
    const newId = `conv-${Date.now()}`;
    const newChat: Conversation = {
      id: newId,
      title: 'New conversation',
      model: selectedModel,
      created_at: Date.now() / 1000,
      updated_at: Date.now() / 1000,
      message_count: 0,
    };

    setConversations((prev) => {
      const updated = [newChat, ...prev];
      try {
        localStorage.setItem('nusa_local_conversations', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
    setActiveChatId(newId);
    setMessages([]);
    setMemoryFacts([]);
    setActiveView('chat');

    try {
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChat),
      });
    } catch {
      // Static fallback already persisted locally
    }
  };

  // Handle deleting a conversation
  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);
    try {
      localStorage.setItem('nusa_local_conversations', JSON.stringify(remaining));
      localStorage.removeItem(`nusa_local_messages_${id}`);
    } catch {
      // ignore
    }
    if (activeChatId === id) {
      setActiveChatId(remaining[0]?.id || null);
    }
    showToast('Conversation deleted.');

    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      fetchStats();
    } catch {
      // Static mode
    }
  };

  // Handle clearing all conversations
  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all conversations?')) return;
    setConversations([]);
    setActiveChatId(null);
    setMessages([]);
    setMemoryFacts([]);
    try {
      localStorage.removeItem('nusa_local_conversations');
    } catch {
      // ignore
    }
    showToast('All conversations cleared.');

    try {
      await fetch('/api/conversations', { method: 'DELETE' });
      fetchStats();
    } catch {
      // Static mode
    }
  };

  // Handle sending a message
  const handleSendMessage = (textOverride?: string) => {
    const text = (textOverride !== undefined ? textOverride : input).trim();
    if (!text && !attachedFile) return;
    if (isStreaming) return;

    let targetConvId = activeChatId;

    // Create chat immediately if none is active (non-blocking)
    if (!targetConvId) {
      targetConvId = `conv-${Date.now()}`;
      const title = text.slice(0, 32) + (text.length > 32 ? '...' : '');
      const newChat: Conversation = {
        id: targetConvId,
        title: title || 'New conversation',
        model: selectedModel,
        created_at: Date.now() / 1000,
        updated_at: Date.now() / 1000,
        message_count: 1,
      };

      setConversations((prev) => {
        const updated = [newChat, ...prev];
        try {
          localStorage.setItem('nusa_local_conversations', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
      setActiveChatId(targetConvId);

      // Save to backend asynchronously
      fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChat),
      }).catch(() => {});
    }

    let fullPrompt = text;
    if (attachedFile) {
      fullPrompt = `${text ? text + '\n\n' : ''}[File Attached: ${attachedFile.name} (${(attachedFile.size / 1024 / 1024).toFixed(2)} MB)]`;
      setAttachedFile(null);
    }

    const userMsgId = `user-${Date.now()}`;
    const asstMsgId = `asst-${Date.now()}`;

    // Optimistically add user message immediately
    const optimisticUserMsg: Message = {
      id: userMsgId,
      conversation_id: targetConvId,
      role: 'user',
      content: fullPrompt,
      created_at: Date.now() / 1000,
    };
    setMessages((prev) => {
      const updated = [...prev, optimisticUserMsg];
      try {
        localStorage.setItem(`nusa_local_messages_${targetConvId}`, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    setInput('');

    // If it's the first message, update title
    if (messages.length === 0) {
      const summaryTitle = text.slice(0, 32) + (text.length > 32 ? '...' : '');
      setConversations((prev) => {
        const updated = prev.map((c) => (c.id === targetConvId ? { ...c, title: summaryTitle } : c));
        try {
          localStorage.setItem('nusa_local_conversations', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    }

    const applyStaticFallbackReply = () => {
      const offlineReply: Message = {
        id: asstMsgId,
        conversation_id: targetConvId!,
        role: 'assistant',
        content: `**NUSA AI (Static Preview Mode)**\n\nYou asked: "${fullPrompt}"\n\nThe frontend is running smoothly on static hosting (such as GitHub Pages). Live AI streaming, WebSocket responses, and the Python SQLite memory engine require the Node.js + Python backend server (\`npm start\`).\n\nYour conversation history and login session are saved locally in your browser.`,
        created_at: Date.now() / 1000,
      };
      setMessages((prev) => {
        const updated = [...prev, offlineReply];
        try {
          localStorage.setItem(`nusa_local_messages_${targetConvId}`, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
      try {
        const qaList = JSON.parse(localStorage.getItem('nusa_local_qa') || '[]');
        const nextQa = Array.isArray(qaList) ? qaList : [];
        nextQa.unshift({
          id: `qa-${Date.now()}`,
          conversation_id: targetConvId,
          question: fullPrompt,
          answer: offlineReply.content,
          model: selectedModel,
          latency_ms: 12,
          tokens: offlineReply.content.split(/\s+/).length,
          created_at: Date.now() / 1000,
        });
        localStorage.setItem('nusa_local_qa', JSON.stringify(nextQa.slice(0, 100)));
      } catch {
        // ignore
      }
      setIsStreaming(false);
      showToast('Static mode: saved locally (backend offline).');
    };

    // Send over WebSocket immediately for real-time streaming when connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsStreaming(true);
      setStreamingText('');
      wsRef.current.send(
        JSON.stringify({
          type: 'send_message',
          conversationId: targetConvId,
          userMessageId: userMsgId,
          assistantMessageId: asstMsgId,
          content: fullPrompt,
          model: selectedModel,
          webResearch,
        })
      );
    } else if (backendAvailableRef.current !== false) {
      // Fast HTTP NDJSON streaming backup so user never waits for WebSocket reconnect
      setIsStreaming(true);
      setStreamingText('');
      (async () => {
        try {
          const res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: targetConvId,
              userMessageId: userMsgId,
              assistantMessageId: asstMsgId,
              content: fullPrompt,
              model: selectedModel,
              webResearch,
            }),
          });
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || !res.body || !ct.includes('ndjson')) {
            throw new Error('Stream unavailable');
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullAcc = '';
          let receivedDone = false;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              const evt = JSON.parse(line);
              if (evt.type === 'chunk') {
                fullAcc += evt.text;
                setStreamingText((prev) => prev + evt.text);
              } else if (evt.type === 'done') {
                receivedDone = true;
                setLastLatencyMs(evt.latencyMs);
                const newAssistantMsg: Message = {
                  id: evt.assistantMessageId || asstMsgId,
                  conversation_id: targetConvId!,
                  role: 'assistant',
                  content: evt.fullText || fullAcc,
                  tokens: evt.tokens,
                  created_at: Date.now() / 1000,
                };
                setMessages((prev) => [...prev, newAssistantMsg]);
                setStreamingText('');
                setIsStreaming(false);
                fetchConversations();
                fetchStats();
              } else if (evt.type === 'error') {
                receivedDone = true;
                setStreamingText('');
                setIsStreaming(false);
                showToast(`Error: ${evt.message}`);
              }
            }
          }
          if (!receivedDone) {
            if (fullAcc) {
              setMessages((prev) => [
                ...prev,
                {
                  id: asstMsgId,
                  conversation_id: targetConvId!,
                  role: 'assistant',
                  content: fullAcc,
                  created_at: Date.now() / 1000,
                },
              ]);
            }
            setStreamingText('');
            setIsStreaming(false);
          }
        } catch {
          setStreamingText('');
          backendAvailableRef.current = false;
          applyStaticFallbackReply();
        }
      })();
    } else {
      applyStaticFallbackReply();
    }
  };

  // Handle Stop Streaming
  const handleStopStreaming = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
    setIsStreaming(false);
  };

  // Handle Regenerate
  const handleRegenerate = (index: number) => {
    const prevUserMsg = [...messages.slice(0, index)].reverse().find((m) => m.role === 'user');
    if (prevUserMsg) {
      handleSendMessage(prevUserMsg.content);
    }
  };

  // Handle Copy
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    showToast('Copied to clipboard!');
  };

  // Handle Share
  const handleShare = () => {
    const text = messages.map((m) => `${m.role === 'user' ? 'You' : 'NUSA AI'}: ${m.content}`).join('\n\n');
    if (navigator.share) {
      navigator.share({ title: 'NUSA AI Conversation', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      showToast('Full conversation copied to clipboard for sharing!');
    }
  };

  // Theme Toggle
  const handleToggleTheme = () => {
    setIsLightMode(!isLightMode);
    document.body.classList.toggle('light', !isLightMode);
    showToast(!isLightMode ? 'Light theme enabled' : 'Dark theme enabled');
  };

  // Memory management actions
  const handleDeleteFact = async (factId: string) => {
    try {
      await fetch(`/api/memory/${factId}`, { method: 'DELETE' });
      setMemoryFacts((prev) => prev.filter((f) => f.id !== factId));
      showToast('Memory fact deleted.');
      fetchStats();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearMemory = async () => {
    if (!activeChatId) return;
    try {
      await fetch(`/api/conversations/${activeChatId}/memory`, { method: 'DELETE' });
      setMemoryFacts([]);
      showToast('Conversation memory cleared.');
      fetchStats();
    } catch (e) {
      console.error(e);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
      }
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
        setIsMemoryModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle login success (Email, Google, or Registration)
  const handleLoginSuccess = (user: any) => {
    // If incoming user doesn't have role, ensure defaults
    const accountUser: UserAccount = {
      id: user.id || `usr_${Date.now()}`,
      name: user.name || 'NUSA User',
      email: user.email || '',
      role: user.role || (user.email === 'ahmaduzair1418@gmail.com' || user.email === 'admin@nusa.ai' ? 'admin' : 'user'),
      avatar_url: user.avatar_url || user.picture || '',
      status: user.status || 'active',
      created_at: user.created_at || Date.now() / 1000,
      last_login: Date.now() / 1000,
    };

    setCurrentUser(accountUser);
    try {
      localStorage.setItem('nusa_user', JSON.stringify(accountUser));
    } catch (e) {
      console.error(e);
    }
    // Only after authentication succeeds, show the welcome overlay
    setShowWelcomeOverlay(true);
    showToast(`Welcome to NUSA AI, ${accountUser.name}!`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('nusa_user');
    showToast('Signed out successfully.');
    setActiveView('chat');
  };

  const handleElevateToAdmin = () => {
    if (currentUser) {
      const updated: UserAccount = { ...currentUser, role: 'admin' };
      setCurrentUser(updated);
      localStorage.setItem('nusa_user', JSON.stringify(updated));
    } else {
      const adminUser: UserAccount = {
        id: 'usr_admin_elevated',
        name: 'NUSA Master Admin',
        email: 'admin@nusa.ai',
        role: 'admin',
        status: 'active',
        created_at: Date.now() / 1000,
      };
      setCurrentUser(adminUser);
      localStorage.setItem('nusa_user', JSON.stringify(adminUser));
    }
  };

  const handleTriggerWelcomePreview = () => {
    setShowWelcomeOverlay(true);
  };

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeView={activeView}
        setActiveView={setActiveView}
        conversations={conversations}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          setActiveChatId(id);
          setActiveView('chat');
        }}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onClearAll={handleClearAll}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        totalQACount={stats?.total_qa_pairs ?? 0}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <main className="main-panel">
        <Topbar
          onOpenSidebar={() => setIsSidebarOpen(true)}
          selectedModel={selectedModel}
          onSelectModel={(m) => {
            setSelectedModel(m);
            showToast(`${m} activated`);
          }}
          wsStatus={wsStatus}
          latencyMs={lastLatencyMs}
          memoryCount={memoryFacts.length}
          onOpenMemoryModal={() => setIsMemoryModalOpen(true)}
          isLightMode={isLightMode}
          onToggleTheme={handleToggleTheme}
          onShare={handleShare}
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onNavigateToAdmin={() => setActiveView('admin')}
          onNavigateToLogin={() => setActiveView('login')}
        />

        {activeView === 'library' ? (
          <QADataHub
            stats={stats}
            onOpenConversation={(convId) => {
              setActiveChatId(convId);
              setActiveView('chat');
            }}
            onShowToast={showToast}
          />
        ) : activeView === 'login' ? (
          <LoginPage
            currentUser={currentUser}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            onNavigateToChat={() => setActiveView('chat')}
            onNavigateToAdmin={() => setActiveView('admin')}
            onShowToast={showToast}
          />
        ) : activeView === 'admin' ? (
          <AdminPanel
            currentUser={currentUser}
            onElevateToAdmin={handleElevateToAdmin}
            onNavigateToChat={() => setActiveView('chat')}
            onNavigateToLogin={() => setActiveView('login')}
            onShowToast={showToast}
          />
        ) : (
          <>
            <section className="chat-scroll" ref={chatScrollRef}>
              {messages.length === 0 && !isStreaming ? (
                <WelcomeView onSelectPrompt={(p) => handleSendMessage(p)} />
              ) : (
                <MessageList
                  messages={messages}
                  isStreaming={isStreaming}
                  streamingText={streamingText}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
                />
              )}
            </section>

            <Composer
              input={input}
              setInput={setInput}
              onSend={() => handleSendMessage()}
              onStop={handleStopStreaming}
              isStreaming={isStreaming}
              webResearch={webResearch}
              setWebResearch={setWebResearch}
              attachedFile={attachedFile}
              setAttachedFile={setAttachedFile}
              onShowToast={showToast}
            />
          </>
        )}
      </main>

      {/* Memory Management Modal */}
      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        facts={memoryFacts}
        onDeleteFact={handleDeleteFact}
        onClearMemory={handleClearMemory}
      />

      {/* Google OAuth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        onTriggerWelcomePreview={handleTriggerWelcomePreview}
      />

      {/* Google Login Welcome Animation Overlay with Multicolored Traveling Outline */}
      <WelcomeOverlay
        isOpen={showWelcomeOverlay}
        onComplete={() => setShowWelcomeOverlay(false)}
        userName={currentUser?.name}
        userEmail={currentUser?.email}
        durationMs={2800}
      />

      {/* Toast Notification */}
      <div className={`toast ${toastMessage ? 'show' : ''}`} role="status">
        {toastMessage}
      </div>
    </div>
  );
}
