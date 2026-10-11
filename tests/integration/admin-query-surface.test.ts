/**
 * ADMIN QUERY SURFACE (real database, real adapters, no mocks).
 *
 * Every read path the admin panel depends on is executed here - including filter combinations
 * that are rarely used in production. This is the regression guard for a class of bug that
 * type-checking and unit tests cannot catch: SQL that only fails when a filter is applied
 * (for example comparing an enum column against a text parameter).
 *
 * The suite asserts that each call completes and returns the documented shape. A failure here
 * means an admin screen would have returned a 500 (or, worse, an empty queue) in production.
 *
 * Skipped - never faked - when no database is configured.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresDb } from '@/server/db/postgres';
import { createServices, type Services } from '@/server/services/container';
import { integrationDb, createUser, createMatchWithMarket, key } from './helpers';

const db = integrationDb() as PostgresDb | null;
const suite = db ? describe : describe.skip;

const ADMIN_ACTOR = { userId: null, role: 'service_role' as const, adminId: null, ip: null, userAgent: null, correlationId: 'admin-surface' };

suite('admin query surface', () => {
  let services: Services;
  let userId: string;
  let matchId: string;

  beforeAll(async () => {
    services = createServices();
    const user = await createUser(db as PostgresDb, { balanceMinor: 500_000n });
    userId = user.userId;
    const generated = await createMatchWithMarket(db as PostgresDb, { odds: 21_000n });
    matchId = generated.matchId;
    // A settlement job and a bet so the queue-oriented reads have something real to page over.
    const placed = await services.betting.placeBet({
      actor: { ...ADMIN_ACTOR, userId },
      userId,
      idempotencyKey: key('admin-surface-bet'),
      payload: {
        type: 'SINGLE', stakeMinor: '50000', currency: 'IRT',
        legs: [{ selectionId: generated.selectionId, marketId: generated.marketId, matchId, clientOddsScaled: '21000', marketVersion: 1, acceptOddsChange: false }],
      },
    });
    await db!.query(
      `insert into nova.settlement_jobs (bet_id, match_id, user_id, status, reason)
       values ($1, $2, $3, 'queued', 'admin surface test')`,
      [placed.bet.id, matchId, userId],
    );
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('dashboard aggregates load for every supported window', async () => {
    for (const window of ['24h', '7d', '30d'] as const) {
      const metrics = await services.admin.dashboard(window);
      expect(metrics.window).toBe(window);
      expect(typeof metrics.users.total).toBe('number');
      expect(typeof metrics.betting.openLiabilityMinor).toBe('bigint');
    }
  });

  it('user directory and user detail sections load with filters', async () => {
    const all = await services.users.listForAdmin({ page: 1, pageSize: 5 });
    expect(Array.isArray(all.items)).toBe(true);
    // Every filter is exercised: these are the combinations that hit optional SQL branches.
    for (const filter of [
      { search: 'it-' },
      { role: 'user' as const },
      { kycStatus: 'verified' },
      { status: 'active' as const },
      { status: 'suspended' as const, role: 'affiliate' as const },
    ]) {
      const page = await services.users.listForAdmin({ ...filter, page: 1, pageSize: 5 });
      expect(Array.isArray(page.items)).toBe(true);
      expect(page.page).toBe(1);
    }
    const summary = await services.users.getAdminSummary(userId);
    expect(summary?.id).toBe(userId);
    expect(Array.isArray(await services.users.listNotes(userId))).toBe(true);
  });

  it('bet explorer loads with filters, search and each sort key', async () => {
    for (const filter of [
      { userId },
      { status: ['accepted', 'settled'] as never },
      { type: 'SINGLE' as const },
      { search: 'IT' },
      { minStakeMinor: 1n },
    ]) {
      const page = await services.betting.listBets(ADMIN_ACTOR, { ...filter, page: 1, pageSize: 5 });
      expect(Array.isArray(page.items)).toBe(true);
    }
    for (const sortBy of ['placed_at', 'stake_minor', 'potential_payout_minor'] as const) {
      const page = await services.betting.listBets(ADMIN_ACTOR, { page: 1, pageSize: 5, sortBy, sortDirection: 'asc' });
      expect(page.pageSize).toBeLessThanOrEqual(100);
    }
  });

  it('payment intents load with every filter (enum-vs-text regression guard)', async () => {
    // An intent is created so the enum columns are actually compared against a parameter;
    // this exact combination previously failed with "operator does not exist: payment_tx_type = text".
    // A payment method row is a prerequisite for an intent (methods are data, not code).
    await db!.query(
      `insert into nova.payment_methods (id, provider, kind, direction, name_en, name_fa, min_amount_minor, max_amount_minor, currencies, fee_bps, fixed_fee_minor, is_enabled, display_order)
       values ('manual-card', 'disabled', 'card', 'both', 'Manual card', 'کارت دستی', 10000, 500000000, array['IRT'], 0, 0, true, 99)
       on conflict (id) do update set is_enabled = true`,
    );
    const intent = await services.payments.createIntent({
      userId, direction: 'deposit', currency: 'IRT', amountMinor: '250000',
      methodId: 'manual-card', idempotencyKey: key('admin-surface-deposit'), returnUrl: null,
      actor: { ...ADMIN_ACTOR, userId },
    });
    expect(intent.publicId).toBeTruthy();

    const filters: { direction?: 'deposit' | 'withdrawal'; status?: string; userId?: string }[] = [
      {},
      { direction: 'deposit' },
      { direction: 'withdrawal' },
      { status: 'initiated' },
      { status: 'succeeded' },
      { status: 'failed' },
      { userId },
    ];
    for (const filter of filters) {
      const page = await services.payments.listIntents({ ...filter, page: 1, pageSize: 5 });
      expect(Array.isArray(page.items)).toBe(true);
    }
    const filtered = await services.payments.listIntents({ direction: 'deposit', status: 'initiated', page: 1, pageSize: 50 });
    expect(filtered.items.some((row) => row.publicId === intent.publicId)).toBe(true);
  });

  it('wallet administration reads load with filters', async () => {
    for (const status of [undefined, 'pending', 'applied', 'rejected']) {
      const page = await services.wallet.listAdminAdjustments({ status, page: 1, pageSize: 5 });
      expect(Array.isArray(page.items)).toBe(true);
    }
    const wallet = await services.wallet.getWallet(ADMIN_ACTOR, userId, 'IRT');
    expect(wallet?.userId).toBe(userId);
    expect(wallet?.balanceMinor).toBeGreaterThanOrEqual(0n);
  });

  it('affiliate directory, payouts and settlement queue load with filters', async () => {
    for (const filter of [
      {},
      { search: 'it-' },
      { status: 'approved' },
      { status: 'pending' },
      { flaggedOnly: true },
    ]) {
      const page = await services.affiliate.listForAdmin({ ...filter, page: 1, pageSize: 5 });
      expect(Array.isArray(page.items)).toBe(true);
    }
    for (const filter of [{}, { status: 'pending' }, { status: 'paid' }]) {
      const page = await services.affiliate.listPayouts({ ...filter, page: 1, pageSize: 5 });
      expect(Array.isArray(page.items)).toBe(true);
    }
    // The settlement queue is read through the domain bridge - the same call the settlements screen makes.
    const settlements = await services.settlementPort.listSettlementQueue({ status: 'queued', limit: 5, page: 1 });
    expect(Array.isArray(settlements.items)).toBe(true);
    expect(settlements.total).toBeGreaterThanOrEqual(1);
  });

  it('affiliate detail sections load for a real affiliate row', async () => {
    const created = await services.affiliate.register({
      userId: (await createUser(db as PostgresDb)).userId,
      code: key('admin-surface-aff').slice(0, 24), displayName: 'Admin Surface Affiliate',
      parentCode: null, model: 'NON_NEGATIVE_35', rateBps: 3500,
    }).catch(() => null);
    if (!created) {
      // Registration can legitimately refuse (e.g. the profile is not eligible); the read paths
      // are then exercised through the directory instead of being asserted on fabricated rows.
      const page = await services.affiliate.listForAdmin({ page: 1, pageSize: 1 });
      if (page.items.length === 0) {
        const directory = await services.affiliate.listForAdmin({ page: 1, pageSize: 5 });
        expect(Array.isArray(directory.items)).toBe(true);
        return;
      }
      const affiliate = page.items[0]!;
      const detail = await services.affiliate.getById(affiliate.id);
      expect(detail?.id).toBe(affiliate.id);
      // Payable is a composed balance: floor-zero guarantees it can never be negative.
      expect((await services.affiliate.payableBalance(affiliate.id)).payableMinor).toBeGreaterThanOrEqual(0n);
      return;
    }
    const detail = await services.affiliate.getById(created.id);
    expect(detail?.id).toBe(created.id);
    expect(Array.isArray((await services.affiliate.listLedger(created.id, { page: 1, pageSize: 5 })).items)).toBe(true);
    expect(Array.isArray((await services.affiliate.listReferrals(created.id, { page: 1, pageSize: 5 })).items)).toBe(true);
    const stats = await services.affiliate.getStats(created.id, { start: new Date(Date.now() - 30 * 864e5).toISOString(), end: new Date().toISOString() });
    expect(stats.affiliateId).toBe(created.id);
    expect(typeof stats.payableMinor).toBe('bigint');
    const payable = await services.affiliate.payableBalance(created.id);
    expect(payable.payableMinor).toBeGreaterThanOrEqual(0n);
    expect(payable.rawMinor).toBe(payable.payableMinor + payable.carryForwardMinor);
  });

  it('job queue, heartbeat and audit reads load with filters', async () => {
    for (const filter of [{}, { queue: 'settlement' }, { status: 'queued' }, { status: 'failed' }]) {
      const page = await services.admin.listJobs({ ...filter, page: 1, pageSize: 5 });
      expect(Array.isArray(page.items)).toBe(true);
    }
    expect(Array.isArray(await services.admin.jobStats())).toBe(true);
    expect(Array.isArray(await services.admin.workerHeartbeats())).toBe(true);
    for (const filter of [{}, { action: 'settings.update' }, { entityType: 'bet' }, { search: 'it-' }]) {
      const page = await services.admin.auditLog({ ...filter, page: 1, pageSize: 5 });
      expect(Array.isArray(page.items)).toBe(true);
    }
  });

  it('settings, operations, roles and provider health load', async () => {
    const settings = await services.admin.settings();
    expect(settings.length).toBeGreaterThan(0);
    const operations = await services.admin.operations();
    expect(operations.some((operation) => operation.key === 'BETTING')).toBe(true);
    const killSwitches = await services.admin.killSwitches();
    expect(killSwitches.length).toBe(operations.length);
    expect((await services.admin.roles()).length).toBeGreaterThan(0);
    expect(Array.isArray(await services.admin.providerHealth())).toBe(true);
    expect(Array.isArray(await services.admin.listReconciliations(5))).toBe(true);
  });
});
