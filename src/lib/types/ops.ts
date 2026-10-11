import type { ISODateString, UUID } from './common';

/** Mirrors the authoritative `job_status` enum 1:1. */
export type JobStatus = (typeof import('@/lib/db-enums').JOB_STATUS)[number];
export interface Job {
  id: UUID; queue: string; kind: string; payload: Record<string, unknown>; status: JobStatus;
  priority: number; attempts: number; maxAttempts: number; lockedBy: string | null; lockedAt: ISODateString | null;
  availableAt: ISODateString; startedAt: ISODateString | null; finishedAt: ISODateString | null;
  lastError: string | null; idempotencyKey: string | null; runAfter: ISODateString | null;
  createdAt: ISODateString; updatedAt: ISODateString;
}
export interface WorkerHeartbeat {
  workerId: string; queue: string; status: 'starting' | 'idle' | 'busy' | 'stopping' | 'error' | 'dead';
  lastSeenAt: ISODateString; startedAt: ISODateString; processedCount: number; failedCount: number;
  currentJobId: UUID | null; hostname: string | null; version: string | null; metrics: Record<string, unknown> | null;
}
export type HealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';
export interface HealthCheckResult {
  name: string; status: HealthStatus; latencyMs: number | null; message: string | null;
  critical: boolean; checkedAt: ISODateString; details?: Record<string, unknown>;
}
export interface HealthReport {
  status: HealthStatus; version: string; environment: string; uptimeSeconds: number;
  checkedAt: ISODateString; durationMs: number; checks: HealthCheckResult[];
}
export interface ReconciliationIssue {
  checkKey: string; severity: 'info' | 'warning' | 'critical'; description: string;
  entityType: string; entityId: string | null; expected: string | null; actual: string | null; detectedAt: ISODateString;
}
export interface ReconciliationReport {
  id: UUID | null; runAt: ISODateString; durationMs: number; passed: boolean;
  checksRun: number; issues: ReconciliationIssue[]; summary: Record<string, unknown>;
}
export interface ProviderHealth {
  provider: string; category: 'sports' | 'payments' | 'notifications'; configured: boolean; reachable: boolean | null;
  enabled: boolean; lastSuccessAt: ISODateString | null; lastErrorAt: ISODateString | null; lastError: string | null;
  requiredEnv: string[]; notes: string;
}
