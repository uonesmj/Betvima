/** Browser-side session HTTP contract. No authorization is inferred from network state. */
export type SessionStatus = {
  authenticated: boolean;
  authUnavailable: boolean;
  user: unknown;
  sessionCheckFailed?: boolean;
};

/** An API failure is not the same thing as confirmed missing Supabase configuration. */
export function sessionTransportFailure() {
  return {
    authenticated: false,
    authUnavailable: false,
    sessionCheckFailed: true,
    user: null,
  } as const;
}

/** Only a successful valid API envelope can report authUnavailable or privileges. */
export function verifiedSessionEnvelope<T extends SessionStatus>(httpOk: boolean, payload: unknown): T {
  if (!httpOk || typeof payload !== 'object' || payload === null
      || !('ok' in payload) || payload.ok !== true
      || !('data' in payload) || typeof payload.data !== 'object' || payload.data === null) {
    throw new Error('SESSION_HTTP_OR_ENVELOPE_UNAVAILABLE');
  }
  const status = payload.data as Record<string, unknown>;
  if (typeof status.authenticated !== 'boolean' || typeof status.authUnavailable !== 'boolean'
      || !(status.user === null || typeof status.user === 'object')
      || (status.authenticated && (status.user === null || status.authUnavailable))
      || (!status.authenticated && status.user !== null)) {
    throw new Error('SESSION_INVALID_RESPONSE');
  }
  return status as T;
}
