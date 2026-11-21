import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import readline from 'readline';

const PYTHON_CLI_PATH = path.resolve(process.cwd(), 'backend', 'cli.py');

export interface PythonBridgeResponse<T = any> {
  error?: string;
  [key: string]: any;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

let workerProcess: ChildProcessWithoutNullStreams | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function ensureWorker(): ChildProcessWithoutNullStreams {
  if (workerProcess && !workerProcess.killed && workerProcess.exitCode === null) {
    return workerProcess;
  }

  const proc = spawn('python3', [PYTHON_CLI_PATH, '--worker'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl = readline.createInterface({ input: proc.stdout });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.ready) return;
      const reqId = msg.id;
      const pending = pendingRequests.get(reqId);
      if (!pending) return;
      pendingRequests.delete(reqId);

      if (msg.error) {
        pending.reject(new Error(msg.error));
      } else if (msg.result?.error) {
        pending.reject(new Error(msg.result.error));
      } else {
        pending.resolve(msg.result);
      }
    } catch (err) {
      console.error('[Python Worker] Parse error:', trimmed, err);
    }
  });

  proc.stderr.on('data', (chunk) => {
    console.error('[Python Worker stderr]:', chunk.toString());
  });

  proc.on('exit', (code) => {
    workerProcess = null;
    for (const [id, pending] of pendingRequests.entries()) {
      pendingRequests.delete(id);
      pending.reject(new Error(`Python worker exited unexpectedly with code ${code}`));
    }
  });

  workerProcess = proc;
  return proc;
}

export function callPython<T = any>(command: string, payload: Record<string, any> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      const proc = ensureWorker();
      const id = nextRequestId++;
      pendingRequests.set(id, { resolve, reject });
      const line = JSON.stringify({ id, command, payload }) + '\n';
      proc.stdin.write(line, (err) => {
        if (err) {
          pendingRequests.delete(id);
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
