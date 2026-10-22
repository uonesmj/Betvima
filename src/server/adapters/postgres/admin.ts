import type { Db } from '@/lib/ports/db';
import type { AdminRepository, AuditFilter } from '@/lib/ports/repositories';
import type {
  AdminPermission, AuditLogEntry, Currency, DashboardMetrics, Job, KillSwitchState, Paginated, ProviderHealth,
  ReconciliationReport, RiskRule, SystemSetting, UUID, UserRole, WorkerHeartbeat,
} from '@/lib/types';
import {
  convertAdminAmountToUsd,
  getAdminUsdRates,
} from '@/server/utils/admin-usd';

import { serverEnv } from '@/server/env';
import {
import { ROLE_LABELS, permissionsForRole } from '@/server/auth/rbac';
import { type Row, toBig, toBool, toIso, toIsoOrNull, toJson, toNum, toNumOrNull, toStr, toStrOrNull } from '@/server/db/rows';

export class PostgresAdminRepository implements AdminRepository {
  constructor(readonly db: Db) {}

  async dashboard(window: string): Promise<DashboardMetrics> {
    const interval = window === '7d' ? '7 days' : window === '30d' ? '30 days' : '24 hours';

    type CurrencyAmountRow = {
      currency?: unknown;
      amount_minor?: unknown;
    };

    // The dashboard is denominated in USD minor units. Never convert other
    // currencies with an expired FX provider or silently treat them as USD.
    // Excluded currencies are explicitly reported to the API consumer.
    const excludedCurrencies = new Set<string>();
    const aggregateByCurrency = async (sql: string): Promise<bigint> => {
      const rows = await this.db.query<Row>(sql) as CurrencyAmountRow[];
      let totalUsdMinor = 0n;
      for (const row of rows) {
        const currency = String(row.currency ?? '').trim().toUpperCase();
        if (!currency) continue;
        const amount = toBig(row.amount_minor);
        if (currency === 'USD') {
          totalUsdMinor += amount;
        } else if (amount !== 0n) {
          excludedCurrencies.add(currency);
        }
      }
      return totalUsdMinor;
    };

    const row = await this.db.queryOne<Row>(
      `select
        (select count(*) from nova.profiles where role in ('user','affiliate')) as users_total,
        (select count(*) from nova.profiles where last_login_at > now() - interval '${interval}') as users_active,
        (select count(*) from nova.profiles where created_at > now() - interval '${interval}') as users_new,
        (select count(*) from nova.profiles where email_verified and kyc_status = 'verified') as users_verified,
        (select count(*) from nova.bets where placed_at > now() - interval '${interval}') as bets_count,
        (select count(*) from nova.bets where status in ('accepted','partially_settled')) as open_bets,
        (select count(*) from nova.payment_transactions where type = 'withdrawal' and status in ('pending','requires_action','initiated')) as pending_withdrawals,
        (select count(*) from nova.affiliates where status = 'approved') as active_affiliates,
        (select count(*) from nova.affiliate_payouts where status in ('pending','eligible','approved','processing','manual_review')) as pending_payouts,
        (select count(*) from nova.bets where status = 'manual_review') as manual_review_bets,
        (select count(*) from nova.settlement_jobs where status in ('queued','processing')) as settlement_backlog,
        (select count(*) from nova.webhook_receipts where not processed and received_at > now() - interval '${interval}') as failed_webhooks,
        (select count(*) from nova.affiliate_fraud_flags where status = 'open') as flagged_affiliates,
        (select max(provider_timestamp) from nova.odds_history) as last_odds_at,
        (select max(settled_at) from nova.bets) as last_settlement_at`,
    );

    const [stake, payout, openLiability] = await Promise.all([
      aggregateByCurrency(
            `select currency::text as currency, coalesce(sum(stake_minor),0) as amount_minor
               from nova.bets
              where placed_at > now() - interval '${interval}'
                and status <> 'rejected'
              group by currency`,
          ),
      aggregateByCurrency(
            `select currency::text as currency, coalesce(sum(payout_minor),0) as amount_minor
               from nova.bets
              where settled_at > now() - interval '${interval}'
              group by currency`,
          ),
      aggregateByCurrency(
            `select currency::text as currency, coalesce(sum(potential_payout_minor),0) as amount_minor
               from nova.bets
              where status in ('accepted','partially_settled')
              group by currency`,
          ),
    ]);
    const [deposits, withdrawals, walletLiability] = await Promise.all([
      aggregateByCurrency(
            `select currency::text as currency, coalesce(sum(amount_minor),0) as amount_minor
               from nova.payment_transactions
              where type = 'deposit'
                and status = 'succeeded'
                and completed_at > now() - interval '${interval}'
              group by currency`,
          ),
      aggregateByCurrency(
            `select currency::text as currency, coalesce(sum(amount_minor),0) as amount_minor
               from nova.payment_transactions
              where type = 'withdrawal'
                and status in ('succeeded','requires_action','pending')
                and created_at > now() - interval '${interval}'
              group by currency`,
          ),
      aggregateByCurrency(
            `select currency::text as currency, coalesce(sum(balance_minor),0) as amount_minor
               from nova.wallets
              group by currency`,
          ),
    ]);
    const [pendingPayoutAmount, commission, payable] = await Promise.all([
      aggregateByCurrency(
            `select currency::text as currency, coalesce(sum(amount_minor),0) as amount_minor
               from nova.affiliate_payouts
              where status in ('pending','eligible','approved','processing','manual_review')
              group by currency`,
          ),
      aggregateByCurrency(
            `select currency::text as currency, coalesce(sum(amount_minor),0) as amount_minor
               from nova.affiliate_ledger
              where type in ('user_loss_commission','adjustment')
                and created_at > now() - interval '${interval}'
              group by currency`,
          ),
      aggregateByCurrency(
            `select currency::text as currency, coalesce(sum(payable_minor),0) as amount_minor
               from nova.affiliate_settlements
              where status <> 'skipped'
              group by currency`,
          ),
    ]);
    const env = serverEnv();
    const betsCount = toNum(row?.bets_count);
    const ggr = stake - payout;

    return {
      financialCoverage: {
        currency: 'USD' as const,
        excludedCurrencies: [...excludedCurrencies].sort(),
        complete: excludedCurrencies.size === 0,
      },
      generatedAt: new Date().toISOString(),
      window,
      users: {
        total: toNum(row?.users_total),
        active24h: toNum(row?.users_active),
        new24h: toNum(row?.users_new),
        verified: toNum(row?.users_verified),
      },
      betting: {
        bets24h: betsCount,
        stake24hMinor: stake,
        payout24hMinor: payout,
        ggr24hMinor: ggr,
        openBets: toNum(row?.open_bets),
        openLiabilityMinor: openLiability,
        avgStakeMinor: betsCount > 0 ? stake / BigInt(betsCount) : 0n,
        marginPct: stake > 0n ? Number((ggr * 10_000n) / stake) / 100 : 0,
      },
      wallet: {
        deposits24hMinor: deposits,
        withdrawals24hMinor: withdrawals,
        totalLiabilityMinor: walletLiability,
        pendingWithdrawals: toNum(row?.pending_withdrawals),
      },
      affiliate: {
        activeAffiliates: toNum(row?.active_affiliates),
        commission24hMinor: commission,
        payableMinor: payable,
        pendingPayouts: toNum(row?.pending_payouts),
        pendingPayoutAmountMinor: pendingPayoutAmount,
      },
      risk: {
        flaggedUsers: toNum(row?.flagged_affiliates),
        manualReviewBets: toNum(row?.manual_review_bets),
        failedWebhooks24h: toNum(row?.failed_webhooks),
        settlementBacklog: toNum(row?.settlement_backlog),
      },
      providers: {
        sports: env.SPORTS_PROVIDER,
        payments: env.PAYMENT_PROVIDER,
        lastOddsSyncAt: toIsoOrNull(row?.last_odds_at),
        lastSettlementAt: toIsoOrNull(row?.last_settlement_at),
      },
    };
  }

  async auditLog(filter: AuditFilter): Promise<Paginated<AuditLogEntry>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 50));
    const params = [filter.actorId ?? null, filter.action ?? null, filter.entityType ?? null, filter.entityId ?? null,
      filter.from ?? null, filter.to ?? null, filter.search ?? null, pageSize, (page - 1) * pageSize];
    const where = `where ($1::uuid is null or actor_id = $1) and ($2::text is null or action = $2)
        and ($3::text is null or target_type = $3) and ($4::text is null or target_id = $4)
        and ($5::timestamptz is null or created_at >= $5) and ($6::timestamptz is null or created_at <= $6)
        and ($7::text is null or action ilike '%' || $7 || '%' or target_type ilike '%' || $7 || '%' or target_id ilike '%' || $7 || '%')`;
    const rows = await this.db.query<Row>(`select * from nova.audit_logs ${where} order by created_at desc limit $8 offset $9`, params);
    const count = await this.db.queryOne<Row>(`select count(*) as total from nova.audit_logs ${where}`, params.slice(0, 7));
    const total = toNum(count?.total);
    return {
      items: rows.map((r) => ({
        id: toStr(r.id), actorId: toStrOrNull(r.actor_id), actorEmail: toStrOrNull(r.actor_email),
        actorRole: (toStrOrNull(r.actor_role) as UserRole | null), action: toStr(r.action),
        entityType: toStr(r.target_type), entityId: toStrOrNull(r.target_id),
        before: toJson<Record<string, unknown> | null>(r.before_state, null),
        after: toJson<Record<string, unknown> | null>(r.after_state, null),
        reason: toStrOrNull(r.reason), ipHash: toStrOrNull(r.ip_hash), userAgentHash: toStrOrNull(r.user_agent),
        correlationId: toStrOrNull(r.correlation_id), createdAt: toIso(r.created_at),
      })),
      total, page, pageSize, hasMore: page * pageSize < total,
    };
  }

  async writeAudit(input: { actorId: UUID | null; action: string; entityType: string; entityId?: string | null; before?: unknown; after?: unknown; reason?: string | null; correlationId?: string | null }): Promise<UUID> {
    const id = await this.db.rpc<string>('audit_event', {
      p_actor_id: input.actorId, p_action: input.action, p_target_type: input.entityType,
      p_target_id: input.entityId ?? null, p_before: input.before ?? null, p_after: input.after ?? null,
      p_reason: input.reason ?? null, p_correlation_id: input.correlationId ?? null,
    });
    return String(id ?? '');
  }

  async roles() {
    const counts = await this.db.query<Row>(`select role::text as role, count(*) as total from nova.profiles group by role`);
    const byRole = new Map(counts.map((r) => [toStr(r.role), toNum(r.total)]));
    return Object.entries(ROLE_LABELS).map(([key, label]) => ({
      key, label, permissions: permissionsForRole(key as UserRole) as AdminPermission[],
      isSystem: key === 'user' || key === 'admin' || key === 'super_admin', userCount: byRole.get(key) ?? 0,
    }));
  }

  async riskRules(): Promise<RiskRule[]> {
    const rows = await this.db.query<Row>(`select * from nova.risk_rules order by priority desc, scope`);
    const currencies = rows
      .map((r) => toStrOrNull(r.currency))
      .filter((currency): currency is string => Boolean(currency));
    const rates = await getAdminUsdRates(currencies);

    return rows.map((r) => {
      const currency = toStrOrNull(r.currency);
      const thresholdMinor = r.value_minor === null ? null : toBig(r.value_minor);
      const usdThresholdMinor =
        thresholdMinor === null || !currency
          ? null
          : convertAdminAmountToUsd(thresholdMinor, currency, rates);

      return {
        id: toStr(r.id),
        key: toStr(r.kind),
        scope: toStr(r.scope, 'GLOBAL') as RiskRule['scope'],
        scopeRef: toStrOrNull(r.scope_ref),
        isEnabled: toBool(r.is_active, true),
        thresholdMinor,
        thresholdCount: null,
        thresholdBps: null,
        action: toStr(r.action, 'REVIEW') as RiskRule['action'],
        priority: toNum(r.priority),
        params: {
          reason: toStrOrNull(r.reason),
          currency,
          is_live: toBool(r.is_live),
          usdThresholdMinor,
        },
        updatedAt: toIso(r.updated_at),
        updatedBy: toStrOrNull(r.created_by),
      };
    });
  }

  async upsertRiskRule(input: { rule: Partial<RiskRule> & { key: string }; actorId: UUID }): Promise<RiskRule> {
    const rule = input.rule;
    const row = await this.db.queryOne<Row>(
      `insert into nova.risk_rules (scope, scope_ref, kind, value_minor, currency, is_live, action, priority, is_active, reason, created_by)
       values (coalesce($1,'GLOBAL'), $2, $3, $4, $5, $6, coalesce($7,'REVIEW'), coalesce($8,100), coalesce($9,true), $10, $11)
       returning *`,
      [rule.scope ?? 'GLOBAL', rule.scopeRef ?? null, rule.key, rule.thresholdMinor?.toString() ?? null,
        null, false, rule.action ?? null, rule.priority ?? null, rule.isEnabled ?? null, rule.params?.reason ?? null, input.actorId],
    );
    return (await this.riskRules()).find((r) => r.id === toStr(row!.id)) ?? ({} as RiskRule);
  }

  async settings(filter?: { category?: string; scope?: string }): Promise<SystemSetting[]> {
    const rows = await this.db.query<Row>(
      `select key, value, description, is_public, updated_by, updated_at from nova.system_settings
        where ($1::text is null or key ilike $1 || '%') order by key`, [filter?.category ?? null],
    );
    return rows.map((r) => ({
      key: toStr(r.key), value: toJson<unknown>(r.value, null),
      valueType: typeof toJson<unknown>(r.value, null) === 'number' ? 'number' : typeof toJson<unknown>(r.value, null) === 'boolean' ? 'boolean' : (r.value && typeof r.value === 'object' ? 'json' : 'string'),
      scope: 'GLOBAL', category: toStr(r.key).split('_')[0] ?? 'general',
      label: toStr(r.key), description: toStrOrNull(r.description), isSecret: /key|secret|token|password/i.test(toStr(r.key)),
      isEditable: true, updatedAt: toIso(r.updated_at), updatedBy: toStrOrNull(r.updated_by),
    }));
  }

  async updateSetting(input: { key: string; value: unknown; actorId: UUID }): Promise<SystemSetting> {
    await this.db.query(
      `update nova.system_settings set value = $2::jsonb, updated_by = $3, updated_at = now() where key = $1`,
      [input.key, JSON.stringify(input.value), input.actorId],
    );
    await this.db.rpc('audit_event', {
      p_actor_id: input.actorId, p_action: 'settings.update', p_target_type: 'setting', p_target_id: input.key,
      p_before: null, p_after: input.value as Row, p_reason: 'admin settings update', p_correlation_id: null,
    });
    const settings = await this.settings();
    const updated = settings.find((s) => s.key === input.key);
    if (!updated) throw new Error(`SETTING_NOT_FOUND: ${input.key}`);
    return updated;
  }

  async killSwitches(): Promise<KillSwitchState[]> {
    const rows = await this.db.query<Row>(`select key, enabled, reason, updated_by, updated_at from nova.system_operations order by key`);
    return rows.map((r) => ({
      key: toStr(r.key), isActive: !toBool(r.enabled, true), reason: toStrOrNull(r.reason),
      activatedBy: toStrOrNull(r.updated_by), activatedAt: toIsoOrNull(r.updated_at), expiresAt: null,
    }));
  }

  async setKillSwitch(input: { key: string; isActive: boolean; reason: string; actorId: UUID; expiresAt?: string | null }): Promise<KillSwitchState> {
    await this.db.rpc('set_operation', {
      p_key: input.key, p_enabled: !input.isActive, p_actor: input.actorId, p_reason: input.reason,
    });
    const switches = await this.killSwitches();
    const updated = switches.find((s) => s.key === input.key);
    if (!updated) throw new Error(`KILL_SWITCH_NOT_FOUND: ${input.key}`);
    return updated;
  }

  async operations() {
    const rows = await this.db.query<Row>(`select key, enabled, reason, updated_at from nova.system_operations order by key`);
    return rows.map((r) => ({
      key: toStr(r.key), isEnabled: toBool(r.enabled, toStr(r.key) !== 'LIVE_BETTING'), reason: toStrOrNull(r.reason), updatedAt: toIso(r.updated_at),
    }));
  }

  async setOperation(input: { key: string; isEnabled: boolean; reason: string; actorId: UUID }) {
    await this.db.rpc('set_operation', {
      p_key: input.key, p_enabled: input.isEnabled, p_actor: input.actorId, p_reason: input.reason,
    });
    return { key: input.key, isEnabled: input.isEnabled };
  }

  async maintenanceMode() {
    const row = await this.db.queryOne<Row>(
      `select enabled, reason from nova.system_operations where key = 'MAINTENANCE_MODE'`,
    );
    return { enabled: toBool(row?.enabled), message: toStrOrNull(row?.reason), until: null };
  }

  async setMaintenance(input: { enabled: boolean; message: string; until?: string | null; actorId: UUID }) {
    await this.db.rpc('set_operation', {
      p_key: 'MAINTENANCE_MODE', p_enabled: input.enabled, p_actor: input.actorId,
      p_reason: input.message || (input.enabled ? 'maintenance enabled' : 'maintenance disabled'),
    });
    return { enabled: input.enabled };
  }

  async providerHealth(): Promise<ProviderHealth[]> {
    const rows = await this.db.query<Row>(`select * from nova.provider_health order by kind, provider`);
    return rows.map((r) => ({
      provider: toStr(r.provider), category: (toStr(r.kind, 'sports') === 'payment' ? 'payments' : toStr(r.kind, 'sports')) as ProviderHealth['category'],
      configured: !['disabled', 'not_configured', 'unknown'].includes(toStr(r.provider)),
      reachable: toStr(r.status) === 'healthy' ? true : toStr(r.status) === 'error' ? false : null,
      enabled: toStr(r.status) !== 'disabled',
      lastSuccessAt: toIsoOrNull(r.last_success_at), lastErrorAt: toIsoOrNull(r.last_error_at),
      lastError: toStrOrNull(r.last_error),
      requiredEnv: [], notes: toStr(toJson<Row>(r.metadata, {}).reason, 'No integration configured.'),
    }));
  }

  async workerHeartbeats(): Promise<WorkerHeartbeat[]> {
    const rows = await this.db.query<Row>(`select * from nova.worker_heartbeats order by worker, worker_id`);
    const threshold = Number(process.env.WORKER_HEARTBEAT_STALE_SECONDS ?? 60);
    return rows.map((r) => {
      const lastSeen = new Date(toIso(r.last_seen_at));
      const stale = Date.now() - lastSeen.getTime() > threshold * 1000;
      const metadata = toJson<Record<string, unknown> | null>(r.metadata, null) ?? {};
      // The worker reports its own state in `metadata`; a heartbeat older than the threshold is
      // reported as dead regardless of what it last claimed. Nothing is invented for missing keys.
      const reported = typeof metadata.status === 'string' ? metadata.status : 'idle';
      const status = (stale ? 'dead' : reported) as WorkerHeartbeat['status'];
      return {
        workerId: toStr(r.worker_id), queue: toStr(r.worker), status,
        lastSeenAt: toIso(r.last_seen_at), startedAt: toIso(r.started_at),
        processedCount: toNum(metadata.processed), failedCount: toNum(metadata.failed),
        currentJobId: typeof metadata.current_job === 'string' ? metadata.current_job : null,
        hostname: toStrOrNull(r.hostname), version: toStrOrNull(r.version),
        metrics: metadata,
      };
    });
  }

  async jobStats() {
    const rows = await this.db.query<Row>(
      `select queue,
              count(*) filter (where status = 'queued') as pending,
              count(*) filter (where status = 'processing') as running,
              count(*) filter (where status = 'failed') as failed,
              count(*) filter (where status = 'dead_letter') as dead,
              extract(epoch from (now() - min(run_after) filter (where status = 'queued'))) as oldest_pending_seconds
         from nova.job_queue group by queue order by queue`,
    );
    return rows.map((r) => ({
      queue: toStr(r.queue), pending: toNum(r.pending), running: toNum(r.running),
      failed: toNum(r.failed), dead: toNum(r.dead), oldestPendingSeconds: toNumOrNull(r.oldest_pending_seconds),
    }));
  }

  async listJobs(filter: { queue?: string; status?: string; page?: number; pageSize?: number }): Promise<Paginated<Job>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
    const params = [filter.queue ?? null, filter.status ?? null, pageSize, (page - 1) * pageSize];
    const rows = await this.db.query<Row>(
      `select * from nova.job_queue where ($1::text is null or queue = $1) and ($2::text is null or status::text = $2)
        order by created_at desc limit $3 offset $4`, params,
    );
    const count = await this.db.queryOne<Row>(
      `select count(*) as total from nova.job_queue where ($1::text is null or queue = $1) and ($2::text is null or status::text = $2)`,
      params.slice(0, 2),
    );
    const total = toNum(count?.total);
    return { items: rows.map(mapJob), total, page, pageSize, hasMore: page * pageSize < total };
  }

  async retryJob(input: { jobId: UUID; actorId: UUID }): Promise<Job> {
    const row = await this.db.queryOne<Row>(
      `update nova.job_queue set status = 'queued', locked_by = null, locked_at = null, run_after = now(), last_error = null
        where id = $1 and status in ('failed','dead_letter') returning *`, [input.jobId],
    );
    if (!row) throw new Error('JOB_NOT_RETRYABLE');
    await this.db.rpc('audit_event', {
      p_actor_id: input.actorId, p_action: 'job.retry', p_target_type: 'job', p_target_id: input.jobId,
      p_before: null, p_after: null, p_reason: 'admin retry', p_correlation_id: null,
    });
    return mapJob(row);
  }

  async cancelJob(input: { jobId: UUID; actorId: UUID; reason: string }): Promise<Job> {
    const row = await this.db.queryOne<Row>(
      `update nova.job_queue set status = 'dead_letter', last_error = $2, finished_at = now() where id = $1 returning *`,
      [input.jobId, `cancelled by admin: ${input.reason}`],
    );
    if (!row) throw new Error('JOB_NOT_FOUND');
    return mapJob(row);
  }

  async runReconciliation(input: { periodStart?: string; periodEnd?: string; actorId?: UUID | null }): Promise<ReconciliationReport> {
    const periodEnd = input.periodEnd ?? new Date().toISOString();
    const periodStart = input.periodStart ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const started = Date.now();
    const result = await this.db.rpc<Row>('reconcile_financial_period', {
      p_period_start: periodStart, p_period_end: periodEnd, p_auto_resolve: false,
    });
    const findings = Array.isArray(result?.findings) ? (result.findings as Row[]) : [];
    return {
      id: null, runAt: new Date().toISOString(), durationMs: Date.now() - started,
      passed: findings.length === 0, checksRun: 6,
      issues: findings.map((f) => ({
        checkKey: toStr(f.check_key, 'unknown'),
        severity: (toStr(f.severity, 'warning') as 'info' | 'warning' | 'critical'),
        description: toStr(f.description, 'Reconciliation mismatch'),
        entityType: toStr(f.entity_type, 'system'), entityId: toStrOrNull(f.entity_id),
        expected: toStrOrNull(f.expected), actual: toStrOrNull(f.actual), detectedAt: new Date().toISOString(),
      })),
      summary: { periodStart, periodEnd, findings: findings.length },
    };
  }

  async listReconciliations(limit: number): Promise<ReconciliationReport[]> {
    const rows = await this.db.query<Row>(
      `select * from nova.reconciliation_records order by created_at desc limit $1`, [limit],
    );
    const grouped = new Map<string, Row[]>();
    for (const row of rows) {
      const key = toIso(row.created_at).slice(0, 16);
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    return Array.from(grouped.entries()).map(([key, group]) => ({
      id: toStr(group[0]!.id), runAt: key, durationMs: 0,
      passed: group.every((g) => toStr(g.status) === 'ok'),
      checksRun: group.length,
      issues: group.filter((g) => toStr(g.status) !== 'ok').map((g) => ({
        checkKey: toStr(g.check_key), severity: toStr(g.status) === 'mismatch' ? 'critical' : 'warning',
        description: toStr(toJson<Row>(g.details, {}).description, 'Mismatch detected'),
        entityType: 'reconciliation', entityId: toStrOrNull(g.id),
        expected: toStrOrNull(g.expected_minor), actual: toStrOrNull(g.actual_minor),
        detectedAt: toIso(g.created_at),
      })),
      summary: { differenceMinor: toBig(group[0]!.difference_minor).toString() },
    }));
  }
}

function mapJob(row: Row): Job {
  return {
    id: toStr(row.id), queue: toStr(row.queue), kind: toStr(row.job_key), payload: toJson<Record<string, unknown>>(row.payload, {}),
    status: toStr(row.status, 'queued') as Job['status'], priority: 0, attempts: toNum(row.attempts),
    maxAttempts: toNum(row.max_attempts, 5), lockedBy: toStrOrNull(row.locked_by), lockedAt: toIsoOrNull(row.locked_at),
    availableAt: toIso(row.run_after), startedAt: toIsoOrNull(row.locked_at), finishedAt: toIsoOrNull(row.finished_at),
    lastError: toStrOrNull(row.last_error), idempotencyKey: toStrOrNull(row.idempotency_key),
    runAfter: toIsoOrNull(row.run_after), createdAt: toIso(row.created_at), updatedAt: toIso(row.finished_at ?? row.created_at),
  };
}

export type { Currency };
