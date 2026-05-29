import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export const DEFAULT_STOCKFISH_PATH = 'tools/stockfish/stockfish/stockfish-windows-x86-64-avx2.exe';

export function stockfishPathFromEnv(defaultPath = DEFAULT_STOCKFISH_PATH) {
  return process.env.STOCKFISH_PATH || defaultPath;
}

export function createTimedUciEngine(stockfishPath, { label = 'uci-engine', timeoutMs = 60_000 } = {}) {
  if (!existsSync(stockfishPath)) {
    throw new Error(`[${label}] Stockfish binary not found at ${stockfishPath}`);
  }

  const child = spawn(stockfishPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  let buffer = '';
  let stderr = '';
  let pending = null;

  function settlePending(kind, value) {
    if (!pending) return;
    const current = pending;
    pending = null;
    clearTimeout(current.timer);
    if (kind === 'resolve') current.resolve(value);
    else current.reject(value);
  }

  function exitMessage(reason) {
    const suffix = stderr.trim() ? ` stderr: ${stderr.trim()}` : '';
    return `[${label}] Stockfish ${reason}.${suffix}`;
  }

  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!pending) continue;
      const trimmed = line.trim();
      pending.lines.push(trimmed);
      if (trimmed.includes(pending.token)) {
        settlePending('resolve', pending.lines);
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  child.once('error', (error) => {
    settlePending('reject', new Error(exitMessage(`process error: ${error.message}`)));
  });

  child.once('exit', (code, signal) => {
    if (!pending) return;
    const waitedFor = pending.token;
    settlePending(
      'reject',
      new Error(exitMessage(`exited before "${waitedFor}" (code ${code ?? 'null'}, signal ${signal ?? 'null'})`))
    );
  });

  return {
    send(command) {
      if (!child.stdin.writable) {
        throw new Error(`[${label}] Cannot send "${command}"; Stockfish stdin is closed.`);
      }
      child.stdin.write(`${command}\n`);
    },
    readUntil(token, readTimeoutMs = timeoutMs) {
      if (pending) {
        return Promise.reject(
          new Error(`[${label}] Already waiting for "${pending.token}", cannot wait for "${token}".`)
        );
      }

      return new Promise((resolve, reject) => {
        const lines = [];
        const timer = setTimeout(() => {
          settlePending(
            'reject',
            new Error(exitMessage(`timed out after ${readTimeoutMs}ms waiting for "${token}"`))
          );
          child.kill();
        }, readTimeoutMs);

        pending = { token, resolve, reject, lines, timer };
      });
    },
    quit() {
      if (child.stdin.writable) child.stdin.write('quit\n');
    },
    kill() {
      child.kill();
    },
  };
}
