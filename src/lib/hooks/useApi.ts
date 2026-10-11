'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiErrorShape { code: string; message: string; messageKey: string; details?: unknown; retryable?: boolean }

export class ApiClientError extends Error {
  constructor(readonly code: string, message: string, readonly status: number, readonly details?: unknown, readonly retryable = false) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** Thin fetch wrapper: JSON envelope, correlation id, typed errors, no secrets. */
export async function apiRequest<T>(path: string, init: RequestInit & { json?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  if (init.idempotencyKey) headers.set('idempotency-key', init.idempotencyKey);
  const response = await fetch(path, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    credentials: 'same-origin',
  });
  let payload: unknown = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const error = (payload as { error?: ApiErrorShape } | null)?.error;
    throw new ApiClientError(
      error?.code ?? 'GENERIC', error?.message ?? `HTTP ${response.status}`, response.status, error?.details, error?.retryable ?? false,
    );
  }
  return ((payload as { data?: T } | null)?.data ?? (payload as T));
}

export function useApiQuery<T>(path: string | null, options: { deps?: unknown[]; pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!path) return;
    try {
      setError(null);
      const result = await apiRequest<T>(path);
      if (mounted.current) setData(result);
    } catch (err) {
      if (mounted.current) setError(err instanceof ApiClientError ? err.message : 'Request failed');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setLoadedPath(path);
      }
    }
  }, [path]);

  useEffect(() => {
    mounted.current = true;
    setLoading(Boolean(path));
    if (!path) setLoadedPath(null);
    void load();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...(options.deps ?? [])]);

  useEffect(() => {
    if (!options.pollMs || !path) return;
    const id = setInterval(() => { void load(); }, options.pollMs);
    return () => clearInterval(id);
  }, [options.pollMs, path, load]);

  const effectiveLoading = Boolean(path) && (loading || loadedPath !== path);
  return { data, loading: effectiveLoading, error, reload: load, setData };
}

export function useApiMutation<TInput, TOutput>(fn: (input: TInput) => Promise<TOutput>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TOutput | null>(null);
  const run = useCallback(async (input: TInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn(input);
      setData(result);
      return result;
    } catch (err) {
      const apiError = err instanceof ApiClientError ? err : null;
      setError(apiError?.message ?? 'Request failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fn]);
  return { run, loading, error, data, setError };
}
