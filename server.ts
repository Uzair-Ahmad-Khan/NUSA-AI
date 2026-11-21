import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { callPython } from './server/pythonBridge.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

// Initialize Google Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const app = express();
app.use(express.json({ limit: '10mb' }));

// In-memory fast cache for recent conversation context to avoid DB latency on hot path
const conversationContextCache = new Map<string, { prompt: string; messages: any[] }>();

// Ensure Python database is initialized on startup
callPython('init')
  .then((res) => console.log('[NUSA AI] Python Database connected:', res.stats))
  .catch((err) => console.error('[NUSA AI] Python Database initialization error:', err));

// ================= REST API ROUTES =================

// Get database and memory stats
app.get('/api/stats', async (_req, res) => {
  try {
    const stats = await callPython('get_stats');
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all conversations
app.get('/api/conversations', async (_req, res) => {
  try {
    const data = await callPython('get_conversations');
    res.json(data.conversations || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const { id, title, model } = req.body;
    // Pre-warm empty cache for brand-new conversations so first prompt has 0ms DB wait
    if (id && !conversationContextCache.has(id)) {
      conversationContextCache.set(id, { prompt: '', messages: [] });
    }
    const data = await callPython('save_conversation', { id, title, model });
    res.json(data.conversation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete specific conversation
app.delete('/api/conversations/:id', async (req, res) => {
  try {
    conversationContextCache.delete(req.params.id);
    const data = await callPython('delete_conversation', { id: req.params.id });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all conversations
app.delete('/api/conversations', async (_req, res) => {
  try {
    conversationContextCache.clear();
    const data = await callPython('clear_conversations');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages for conversation
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const data = await callPython('get_messages', { conversation_id: req.params.id });
    const msgs = data.messages || [];
    // Warm context cache asynchronously so next prompt needs zero DB lookup
    if (!conversationContextCache.has(req.params.id)) {
      callPython('get_memory', { conversation_id: req.params.id })
        .then((mem) => {
          conversationContextCache.set(req.params.id, {
            prompt: mem.prompt || '',
            messages: msgs.slice(-6),
          });
        })
        .catch(() => {});
    }
    res.json(msgs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get conversation memory facts
app.get('/api/conversations/:id/memory', async (req, res) => {
  try {
    const data = await callPython('get_memory', { conversation_id: req.params.id });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear memory for conversation
app.delete('/api/conversations/:id/memory', async (req, res) => {
  try {
    const data = await callPython('clear_memory', { conversation_id: req.params.id });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete specific memory fact
app.delete('/api/memory/:factId', async (req, res) => {
  try {
    const data = await callPython('delete_memory_fact', { fact_id: req.params.factId });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Q&A records (Permanent Question-Answer Data Hub)
app.get('/api/qa-records', async (req, res) => {
  try {
    const search = String(req.query.search || '');
    const model = String(req.query.model || '');
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const data = await callPython('get_qa_records', { search, model, limit, offset });
    res.json(data.records || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export Q&A records as JSON or CSV
app.get('/api/qa-records/export', async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const data = await callPython('get_qa_records', { limit: 1000 });
    const records = data.records || [];

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="nusa_ai_qa_records.csv"');
      
      const headers = ['ID', 'Conversation_ID', 'Question', 'Answer', 'Model', 'Latency_ms', 'Tokens', 'Timestamp'];
      const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      
      const rows = records.map((r: any) => [
        escapeCsv(r.id),
        escapeCsv(r.conversation_id),
        escapeCsv(r.question),
        escapeCsv(r.answer),
        escapeCsv(r.model),
        r.latency_ms || 0,
        r.tokens || 0,
        escapeCsv(new Date(r.created_at * 1000).toISOString()),
      ].join(','));

      res.send([headers.join(','), ...rows].join('\n'));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="nusa_ai_qa_records.json"');
      res.send(JSON.stringify(records, null, 2));
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================= AUTHENTICATION ROUTES =================

// Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const result = await callPython('auth_register', { name, email, password, role });
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Log in with email & password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await callPython('auth_login', { email, password });
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Google OAuth user registration/login
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, name, picture } = req.body;
    const result = await callPython('auth_google', { email, name, picture });
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN PANEL ROUTES =================

// Get full Admin dashboard stats
app.get('/api/admin/stats', async (_req, res) => {
  try {
    const result = await callPython('admin_get_stats');
    res.json(result.stats || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all registered users
app.get('/api/admin/users', async (_req, res) => {
  try {
    const result = await callPython('admin_get_users');
    res.json(result.users || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update user role (e.g. promote to 'admin' or demote to 'user')
app.put('/api/admin/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const result = await callPython('admin_update_user_role', { user_id: req.params.id, role });
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update user status ('active' or 'banned')
app.put('/api/admin/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await callPython('admin_update_user_status', { user_id: req.params.id, status });
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user account
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const result = await callPython('admin_delete_user', { user_id: req.params.id });
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get system configuration
app.get('/api/admin/config', async (_req, res) => {
  try {
    const result = await callPython('admin_get_config');
    res.json(result.config || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update system configuration key/value
app.post('/api/admin/config', async (req, res) => {
  try {
    const { key, value } = req.body;
    const result = await callPython('admin_save_config', { key, value });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Shared ultra-fast Gemini streaming helper
async function streamGeminiAnswer({
  conversationId,
  content,
  model = 'NUSA Assistant',
  webResearch = false,
  onChunk,
  shouldAbort,
}: {
  conversationId: string;
  content: string;
  model?: string;
  webResearch?: boolean;
  onChunk: (text: string, index: number) => void;
  shouldAbort?: () => boolean;
}): Promise<{ fullText: string; memoryPrompt: string }> {
  let memoryPrompt = '';
  let historyMessages: any[] = [];
  const cached = conversationContextCache.get(conversationId);
  if (cached) {
    memoryPrompt = cached.prompt;
    historyMessages = cached.messages;
  } else {
    try {
      const ctxData = await callPython('get_chat_context', { conversation_id: conversationId });
      memoryPrompt = ctxData.prompt || '';
      historyMessages = (ctxData.messages || []).slice(-6);
      conversationContextCache.set(conversationId, { prompt: memoryPrompt, messages: historyMessages });
    } catch (memErr) {
      console.warn('[NUSA AI] Context fetch warning:', memErr);
    }
  }

  let personaInstruction =
    'You are NUSA AI, a fast and articulate assistant. Start answering immediately and directly without filler or preamble. Reply in the exact language the user writes in (English, Hindi, Hinglish, etc.).';
  if (model === 'NUSA Code') {
    personaInstruction =
      'You are NUSA Code, an expert software engineer. Start directly with clean, production-ready code and concise explanation.';
  } else if (model === 'NUSA Creative') {
    personaInstruction =
      'You are NUSA Creative, a sharp creative partner. Deliver vivid, direct, well-structured ideas immediately.';
  }

  if (webResearch) {
    personaInstruction += '\nWeb Research mode enabled: organize insights clearly and practically.';
  }
  if (memoryPrompt) {
    personaInstruction += `\n${memoryPrompt}`;
  }

  const formattedContents: any[] = [];
  for (const msg of historyMessages.slice(-6)) {
    formattedContents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  formattedContents.push({
    role: 'user',
    parts: [{ text: content }],
  });

  let fullGeneratedText = '';
  let chunkIndex = 0;

  const runGeneration = async (modelToUse: string, thinkingLevel: ThinkingLevel) => {
    return await ai.models.generateContentStream({
      model: modelToUse,
      contents: formattedContents,
      config: {
        systemInstruction: personaInstruction,
        thinkingConfig: { thinkingLevel },
      },
    });
  };

  try {
    let responseStream;
    try {
      // Zero-thinking mode on gemini-3.1-flash-lite gives near-instant first token
      responseStream = await runGeneration('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL);
    } catch (primaryErr: any) {
      console.warn('[NUSA AI] Primary fast model failed, falling back to gemini-4-hydrogen:', primaryErr.message);
      responseStream = await runGeneration('gemini-4-hydrogen', ThinkingLevel.LOW);
    }

    for await (const chunk of responseStream) {
      if (shouldAbort && shouldAbort()) {
        break;
      }
      const chunkText = chunk.text;
      if (chunkText) {
        fullGeneratedText += chunkText;
        chunkIndex++;
        onChunk(chunkText, chunkIndex);
      }
    }
  } catch (geminiError: any) {
    console.error('[Gemini API Error]:', geminiError);
    const errorMessage = `I encountered an issue generating a response: ${geminiError.message || 'Unknown error'}. Please try asking again.`;
    fullGeneratedText = errorMessage;
    onChunk(errorMessage, 1);
  }

  return { fullText: fullGeneratedText, memoryPrompt };
}

// Fast HTTP NDJSON streaming fallback route (if WebSocket is still handshaking)
app.post('/api/chat/stream', async (req, res) => {
  const {
    conversationId,
    userMessageId,
    assistantMessageId,
    content,
    model = 'NUSA Assistant',
    webResearch = false,
  } = req.body || {};

  if (!conversationId || !content) {
    return res.status(400).json({ error: 'conversationId and content are required' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let aborted = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      aborted = true;
    }
  });

  const startTime = Date.now();
  try {
    res.write(JSON.stringify({ type: 'start', conversationId, assistantMessageId, model }) + '\n');

    const { fullText, memoryPrompt } = await streamGeminiAnswer({
      conversationId,
      content,
      model,
      webResearch,
      shouldAbort: () => aborted,
      onChunk: (text, index) => {
        if (!aborted && !res.writableEnded) {
          res.write(JSON.stringify({ type: 'chunk', conversationId, assistantMessageId, text, index }) + '\n');
        }
      },
    });

    const latencyMs = Date.now() - startTime;
    const estimatedTokens = Math.ceil((content.length + fullText.length) / 4);

    if (!aborted && !res.writableEnded) {
      res.write(
        JSON.stringify({
          type: 'done',
          conversationId,
          assistantMessageId,
          fullText,
          latencyMs,
          tokens: estimatedTokens,
        }) + '\n'
      );
      res.end();
    }

    const existingCache = conversationContextCache.get(conversationId) || { prompt: memoryPrompt, messages: [] };
    conversationContextCache.set(conversationId, {
      prompt: existingCache.prompt,
      messages: [...existingCache.messages, { role: 'user', content }, { role: 'assistant', content: fullText }].slice(-6),
    });

    callPython('save_turn', {
      conversation_id: conversationId,
      user_message: { id: userMessageId, content },
      assistant_message: { id: assistantMessageId, content: fullText },
      model,
      latency_ms: latencyMs,
      tokens: estimatedTokens,
      tags: model,
    }).catch((dbErr) => console.error('[NUSA AI] Background turn save error:', dbErr));
  } catch (err: any) {
    console.error('[HTTP Stream Error]:', err);
    if (!res.writableEnded) {
      res.write(JSON.stringify({ type: 'error', message: err?.message || 'Stream error' }) + '\n');
      res.end();
    }
  }
});

// Create HTTP and WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/chat' });

// Track active streams to allow immediate cancellation via 'stop'
const activeStreams = new Map<WebSocket, { abort: boolean }>();

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Client connected to NUSA AI chat');
  activeStreams.set(ws, { abort: false });

  // Register message listener IMMEDIATELY so zero messages are dropped
  ws.on('message', async (raw: any) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (data.type === 'stop') {
        const streamState = activeStreams.get(ws);
        if (streamState) {
          streamState.abort = true;
          ws.send(JSON.stringify({ type: 'stopped' }));
        }
        return;
      }

      if (data.type === 'send_message') {
        const {
          conversationId,
          userMessageId,
          assistantMessageId,
          content,
          model = 'NUSA Assistant',
          webResearch = false,
        } = data;

        const streamState = { abort: false };
        activeStreams.set(ws, streamState);

        const startTime = Date.now();

        // 1. Send start notification immediately so UI starts typing instantly
        ws.send(JSON.stringify({
          type: 'start',
          conversationId,
          assistantMessageId,
          model,
        }));

        // 2. Stream Gemini answer with minimal latency config
        const { fullText: fullGeneratedText, memoryPrompt } = await streamGeminiAnswer({
          conversationId,
          content,
          model,
          webResearch,
          shouldAbort: () => streamState.abort,
          onChunk: (chunkText, index) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'chunk',
                conversationId,
                assistantMessageId,
                text: chunkText,
                index,
              }));
            }
          },
        });

        const latencyMs = Date.now() - startTime;
        const estimatedTokens = Math.ceil((content.length + fullGeneratedText.length) / 4);

        // 5. Send done signal IMMEDIATELY so the user UI sees completion with zero lag
        ws.send(JSON.stringify({
          type: 'done',
          conversationId,
          assistantMessageId,
          fullText: fullGeneratedText,
          latencyMs,
          tokens: estimatedTokens,
        }));

        // 6. Update fast in-memory context cache immediately
        const existingCache = conversationContextCache.get(conversationId) || { prompt: memoryPrompt, messages: [] };
        const updatedMessages = [
          ...existingCache.messages,
          { role: 'user', content },
          { role: 'assistant', content: fullGeneratedText }
        ].slice(-10);
        conversationContextCache.set(conversationId, {
          prompt: existingCache.prompt,
          messages: updatedMessages
        });

        // 7. Persist turn and extract memories in background (non-blocking for instant speed)
        callPython('save_turn', {
          conversation_id: conversationId,
          user_message: { id: userMessageId, content },
          assistant_message: { id: assistantMessageId, content: fullGeneratedText },
          model,
          latency_ms: latencyMs,
          tokens: estimatedTokens,
          tags: model,
        })
          .then((turnResult: any) => {
            if (turnResult?.extracted_memories && turnResult.extracted_memories.length > 0) {
              // Update memory prompt in cache
              callPython('get_memory', { conversation_id: conversationId }).then((mem) => {
                const cur = conversationContextCache.get(conversationId);
                if (cur) cur.prompt = mem.prompt || '';
              }).catch(() => {});

              ws.send(JSON.stringify({
                type: 'memories_extracted',
                conversationId,
                extractedMemories: turnResult.extracted_memories,
              }));
            }
          })
          .catch((dbErr) => {
            console.error('[NUSA AI] Background turn save error:', dbErr);
          });
      }
    } catch (msgErr: any) {
      console.error('[WebSocket] Error processing message:', msgErr);
      ws.send(JSON.stringify({ type: 'error', message: msgErr.message }));
    }
  });

  ws.on('close', () => {
    activeStreams.delete(ws);
    console.log('[WebSocket] Client disconnected');
  });

  // Send initial handshake asynchronously without blocking incoming messages
  callPython('get_stats')
    .then((statsData) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'handshake', status: 'connected', stats: statsData.stats }));
      }
    })
    .catch(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'handshake', status: 'connected' }));
      }
    });
});

// Configure Vite integration
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[NUSA AI] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[NUSA AI] WebSocket endpoint ready at ws://0.0.0.0:${PORT}/ws/chat`);
  });
}

startServer().catch((err) => {
  console.error('[NUSA AI] Failed to start server:', err);
});
