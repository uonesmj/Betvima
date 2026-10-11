import { ERROR_CODES, type ErrorCode, statusForCode } from './codes';
import { DomainError, isDomainError } from '@/domain/errors';

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** Localisable UI key, e.g. "errors.ODDS_CHANGED". */
    messageKey: string;
    correlationId?: string;
    details?: unknown;
    retryable: boolean;
    /** Present for maintenance/kill-switch style errors. */
    retryAfterSeconds?: number;
  };
}

const RETRYABLE = new Set<ErrorCode>([
  'INTERNAL_ERROR', 'SERVICE_UNAVAILABLE', 'PROVIDER_UNAVAILABLE', 'MAINTENANCE_MODE', 'TIMEOUT',
  'RATE_LIMITED', 'ODDS_EXPIRED', 'ODDS_FRESHNESS_UNAVAILABLE',
]);

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly correlationId?: string;
  readonly retryAfterSeconds?: number;
  readonly expose: boolean;

  constructor(code: ErrorCode, message?: string, options: { details?: unknown; correlationId?: string; retryAfterSeconds?: number; expose?: boolean; cause?: unknown } = {}) {
    super(message ?? code, { cause: options.cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = statusForCode(code);
    this.details = options.details;
    this.correlationId = options.correlationId;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.expose = options.expose ?? true;
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.expose ? this.message : 'Request failed',
        messageKey: `errors.${this.code}`,
        correlationId: this.correlationId,
        details: this.details,
        retryable: this.retryable,
        ...(this.retryAfterSeconds !== undefined ? { retryAfterSeconds: this.retryAfterSeconds } : {}),
      },
    };
  }

  static from(error: unknown, fallback: ErrorCode = 'INTERNAL_ERROR'): ApiError {
    if (error instanceof ApiError) return error;

    const structuralCode =
      typeof error === 'object' && error !== null
        ? (error as { code?: unknown }).code
        : undefined;
    const structuralName =
      typeof error === 'object' && error !== null
        ? (error as { name?: unknown }).name
        : undefined;
    const structuralDetails =
      typeof error === 'object' && error !== null
        ? (error as { details?: unknown }).details
        : undefined;
    const structuralMessage =
      typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : error instanceof Error
          ? error.message
          : undefined;

    const structuralMap: Record<string, ErrorCode> = {
      AGE_NOT_VERIFIED: 'AGE_RESTRICTED',
      INSUFFICIENT_BALANCE: 'INSUFFICIENT_FUNDS',
      ODDS_CHANGED: 'ODDS_CHANGED',
      STALE_ODDS: 'STALE_ODDS',
      MARKET_SUSPENDED: 'MARKET_SUSPENDED',
      VALIDATION_ERROR: 'VALIDATION_FAILED',
      IDEMPOTENT_REPLAY: 'IDEMPOTENCY_CONFLICT',
      ACCOUNT_RESTRICTED: 'ACCOUNT_SUSPENDED',
      ACCOUNT_SELF_EXCLUDED: 'ACCOUNT_SUSPENDED',
      PROVIDER_ERROR: 'PROVIDER_UNAVAILABLE',
      PROVIDER_TIMEOUT: 'TIMEOUT',
      DEPENDENCY_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
      RATE_LIMITED: 'RATE_LIMITED',
    };

    if (
      typeof structuralCode === 'string' &&
      structuralMap[structuralCode] &&
      (structuralName === 'DomainError' ||
        typeof structuralDetails !== 'undefined' ||
        structuralMap[structuralCode] !== undefined)
    ) {
      return new ApiError(structuralMap[structuralCode]!, structuralMessage ?? structuralCode, {
        details: structuralDetails,
        cause: error,
      });
    }

    if (isDomainError(error)) {
      const domainToApi: Partial<Record<typeof error.code, ErrorCode>> = {
        VALIDATION_ERROR: 'VALIDATION_FAILED',
        IDEMPOTENT_REPLAY: 'IDEMPOTENCY_CONFLICT',
        ACCOUNT_RESTRICTED: 'ACCOUNT_SUSPENDED',
        AGE_NOT_VERIFIED: 'AGE_RESTRICTED',
        INSUFFICIENT_BALANCE: 'INSUFFICIENT_FUNDS',
        ODDS_MISSING: 'ODDS_OUT_OF_RANGE',
        SELECTION_SUSPENDED: 'MARKET_SUSPENDED',
        BETSLIP_DUPLICATE_SELECTION: 'DUPLICATE_SELECTION',
        BETSLIP_CONFLICTING_SELECTION: 'CONFLICTING_SELECTIONS',
        PROVIDER_DISABLED: 'PAYMENT_PROVIDER_DISABLED',
        PROVIDER_ERROR: 'PROVIDER_UNAVAILABLE',
        PROVIDER_TIMEOUT: 'TIMEOUT',
        DEPENDENCY_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
        RATE_LIMITED: 'RATE_LIMITED',
        INTERNAL_ERROR: 'INTERNAL_ERROR',
      };
      const apiCode = domainToApi[error.code] ?? (
        Object.prototype.hasOwnProperty.call(ERROR_CODES, error.code)
          ? error.code as ErrorCode
          : 'INTERNAL_ERROR'
      );
      return new ApiError(apiCode, error.message, { details: error.details, cause: error });
    }

    if (error instanceof Error) {
      const messageCodeMap: Record<string, ErrorCode> = {
        AGE_NOT_VERIFIED: 'AGE_RESTRICTED',
        INSUFFICIENT_BALANCE: 'INSUFFICIENT_FUNDS',
        ODDS_CHANGED: 'ODDS_CHANGED',
        STALE_ODDS: 'STALE_ODDS',
        MARKET_SUSPENDED: 'MARKET_SUSPENDED',
        VALIDATION_ERROR: 'VALIDATION_FAILED',
        IDEMPOTENT_REPLAY: 'IDEMPOTENCY_CONFLICT',
        ACCOUNT_RESTRICTED: 'ACCOUNT_SUSPENDED',
        PROVIDER_ERROR: 'PROVIDER_UNAVAILABLE',
        PROVIDER_TIMEOUT: 'TIMEOUT',
        DEPENDENCY_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
        RATE_LIMITED: 'RATE_LIMITED',
      };
      const normalizedMessage = error.message.trim();
      if (messageCodeMap[normalizedMessage]) {
        return new ApiError(messageCodeMap[normalizedMessage]!, error.message, { cause: error });
      }
      const match = /^([A-Z_]{4,})\b/.exec(error.message);
      if (match && Object.prototype.hasOwnProperty.call(ERROR_CODES, match[1]!)) {
        return new ApiError(match[1] as ErrorCode, error.message);
      }
      return new ApiError(fallback, error.message, { expose: false, cause: error });
    }

    return new ApiError(fallback, undefined, { expose: false, cause: error });
  }
}
