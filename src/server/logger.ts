/** Structured JSON logger with correlation ids (spec §63). No secrets, ever. */
import { serverEnv } from './env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT = /(key|secret|token|password|authorization|apikey|service_role)/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT.test(k) ? '[redacted]' : scrub(v, depth + 1);
  }
  return out;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(bindings: Record<string, unknown> = {}, minLevel?: LogLevel): Logger {
  let threshold: LogLevel = minLevel ?? 'info';
  try {
    threshold = minLevel ?? (serverEnv().LOG_LEVEL as LogLevel);
  } catch {
    threshold = minLevel ?? 'info';
  }
  const emit = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    if (ORDER[level] < ORDER[threshold]) return;
    const line = JSON.stringify({
      ts: new Date().toISOString(), level, msg, service: 'nova-sportsbook',
      ...scrub(bindings) as Record<string, unknown>, ...scrub(meta ?? {}) as Record<string, unknown>,
    });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };
  return {
    debug: (m, meta) => emit('debug', m, meta),
    info: (m, meta) => emit('info', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    error: (m, meta) => emit('error', m, meta),
    child: (extra) => createLogger({ ...bindings, ...extra }, threshold),
  };
}

export const logger = createLogger({ component: 'app' });
