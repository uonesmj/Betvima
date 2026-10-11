/**
 * End-to-end integration (REAL database, REAL adapters, no mocks):
 * place -> odds change -> accept -> settle -> wallet/ledger invariants -> cash-out.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { PostgresBettingRepository } from '@/server/adapters/postgres/betting';
import { PostgresWalletRepository } from '@/server/adapters/postgres/wallet';
import { PostgresCatalogRepository } from '@/server/adapters/postgres/catalog';
import { PostgresAffiliateRepository } from '@/server/adapters/postgres/affiliate';
import { SettlementService } from '@/server/services/settlement-service';
import { createMatchWithMarket, createUser, integrationDb, key, asRole } from './helpers';
import type { PostgresDb } from '@/server/db/postgres';

const db = integrationDb() as PostgresDb | null;
const suite = db ? describe : describe.skip;

suite('betting flow against the real database', () => {
  const betting = new PostgresBettingRepository(db as PostgresDb);
  const wallet = new PostgresWalletRepository(db as PostgresDb);
  const catalog = new PostgresCatalogRepository(db as PostgresDb);
  const affiliate = new PostgresAffiliateRepository(db as PostgresDb);
  const settlementService = new SettlementService({ db: db as PostgresDb, betting, catalog });
  // Created lazily inside the first test: top-level await is not allowed in this suite.
  let settlementActor = '';
  const actor = { userId: null, role: 'service_role' as const, correlationId: 'integration' };

  afterAll(async () => {
    if (db) await db.close();
  });

  it('prices, places and settles a single bet with an exact ledger', async () => {
    const { userId } = await createUser(db as PostgresDb, { balanceMinor: 1_000_000n });
    settlementActor = (await createUser(db as PostgresDb, { role: 'admin' })).userId;
    const { matchId, marketId, selectionId } = await createMatchWithMarket(db as PostgresDb, { odds: 25_000n });

    const placed = await betting.placeBet({
      actor: { ...actor, userId },
      userId,
      idempotencyKey: key('it-place'),
      payload: {
        type: 'SINGLE', stakeMinor: '100000', currency: 'IRT',
        legs: [{ selectionId, marketId, matchId, clientOddsScaled: '25000', marketVersion: 1, acceptOddsChange: false }],
      },
    });
    expect(placed.status).toBe('accepted');
    expect(placed.bet.potentialPayoutMinor).toBe(250_000n);
    expect(placed.balanceAfterMinor).toBe(900_000n);

    const afterPlace = await wallet.getWallet(actor, userId, 'IRT');
    expect(afterPlace?.balanceMinor).toBe(900_000n);

    // Server rejects a client-invented price instead of trusting it.
    await expect(betting.placeBet({
      actor: { ...actor, userId },
      userId,
      idempotencyKey: key('it-place-bad'),
      payload: {
        type: 'SINGLE', stakeMinor: '50000', currency: 'IRT',
        legs: [{ selectionId, marketId, matchId, clientOddsScaled: '990000', marketVersion: 1, acceptOddsChange: false }],
      },
    })).rejects.toThrow(/ODDS_CHANGED/);

    // Settlement uses authoritative placement odds (2.50), not the client value.
    // The match must be finished with an authoritative result before settlement runs.
    await db!.query(`update nova.matches set status = 'finished', home_score = 2, away_score = 0, finished_at = now() where id = $1`, [matchId]);
    await db!.query(
      `insert into nova.match_results (match_id, revision, status, home_score, away_score, provider, authoritative)
       values ($1, 1, 'finished', 2, 0, 'integration', true)`, [matchId],
    );
    const planned = await settlementService.settle({
      betId: placed.bet.id, source: 'provider', idempotencyKey: key('it-settle'), actorId: settlementActor,
    });
    expect(planned.plan.status).toBe('settled');
    expect(planned.result?.payoutMinor).toBe(250_000n);
    const settlement = planned.result!;
    expect(settlement.status).toBe('settled');

    const final = await wallet.getWallet(actor, userId, 'IRT');
    expect(final?.balanceMinor).toBe(1_150_000n);

    // One debit + one credit, and the ledger sum equals the stored balance.
    const statement = await wallet.listEntries(actor, userId, { currency: 'IRT' });
    expect(statement.entries.length).toBe(3);   // seed deposit + bet debit + win credit
    expect(statement.totals.netMinor).toBe(final?.balanceMinor);

    // Settling twice must not move money again.
    const replay = await settlementService.settle({
      betId: placed.bet.id, source: 'provider', idempotencyKey: key('it-settle-again'), actorId: settlementActor,
    });
    expect(replay.result === null || replay.result.status === 'idempotent_replay').toBe(true);
    expect((await wallet.getWallet(actor, userId, 'IRT'))?.balanceMinor).toBe(1_150_000n);
  });

  it('requires explicit acceptance when the odds moved, then stores the accepted price', async () => {
    const { userId } = await createUser(db as PostgresDb, { balanceMinor: 500_000n });
    const { matchId, marketId, selectionId } = await createMatchWithMarket(db as PostgresDb, { odds: 20_000n });
    await db!.query(`update nova.selections set odds_scaled = 22000, previous_odds_scaled = 20000, odds_version = 2, odds_updated_at = now() where id = $1`, [selectionId]);

    await expect(betting.placeBet({
      actor: { ...actor, userId }, userId, idempotencyKey: key('it-move'),
      payload: {
        type: 'SINGLE', stakeMinor: '100000', currency: 'IRT',
        legs: [{ selectionId, marketId, matchId, clientOddsScaled: '20000', marketVersion: 1, acceptOddsChange: false }],
      },
    })).rejects.toThrow(/ODDS_CHANGED/);

    const accepted = await betting.placeBet({
      actor: { ...actor, userId }, userId, idempotencyKey: key('it-move-accepted'),
      payload: {
        type: 'SINGLE', stakeMinor: '100000', currency: 'IRT',
        legs: [{ selectionId, marketId, matchId, clientOddsScaled: '20000', marketVersion: 1, acceptOddsChange: true }],
      },
    });
    expect(accepted.status).toBe('accepted');
    expect(accepted.bet.legs[0]!.oddsAtPlacementScaled).toBe(22_000n);
    expect(accepted.bet.potentialPayoutMinor).toBe(220_000n);
  });

  it('is idempotent for a repeated placement key', async () => {
    const { userId } = await createUser(db as PostgresDb, { balanceMinor: 400_000n });
    const { matchId, marketId, selectionId } = await createMatchWithMarket(db as PostgresDb, { odds: 30_000n });
    const idempotencyKey = key('it-idem');
    const first = await betting.placeBet({
      actor: { ...actor, userId }, userId, idempotencyKey,
      payload: { type: 'SINGLE', stakeMinor: '100000', currency: 'IRT', legs: [{ selectionId, marketId, matchId, clientOddsScaled: '30000', marketVersion: 1, acceptOddsChange: false }] },
    });
    const second = await betting.placeBet({
      actor: { ...actor, userId }, userId, idempotencyKey,
      payload: { type: 'SINGLE', stakeMinor: '100000', currency: 'IRT', legs: [{ selectionId, marketId, matchId, clientOddsScaled: '30000', marketVersion: 1, acceptOddsChange: false }] },
    });
    expect(second.status).toBe('idempotent_replay');
    expect(second.bet.id).toBe(first.bet.id);
    expect((await wallet.getWallet(actor, userId, 'IRT'))?.balanceMinor).toBe(300_000n);
    expect((await betting.listBets(actor, { userId })).total).toBe(1);
  });

  it('refuses a stake above the balance and never goes negative', async () => {
    const { userId } = await createUser(db as PostgresDb, { balanceMinor: 50_000n });
    const { matchId, marketId, selectionId } = await createMatchWithMarket(db as PostgresDb, { odds: 20_000n });
    await expect(betting.placeBet({
      actor: { ...actor, userId }, userId, idempotencyKey: key('it-nsf'),
      payload: { type: 'SINGLE', stakeMinor: '100000', currency: 'IRT', legs: [{ selectionId, marketId, matchId, clientOddsScaled: '20000', marketVersion: 1, acceptOddsChange: false }] },
    })).rejects.toThrow(/INSUFFICIENT_BALANCE/);
    const walletRow = await wallet.getWallet(actor, userId, 'IRT');
    expect(walletRow?.balanceMinor).toBe(50_000n);
  });

  it('prices an accumulator and settles it as a product of legs', async () => {
    const { userId } = await createUser(db as PostgresDb, { balanceMinor: 1_000_000n });
    const first = await createMatchWithMarket(db as PostgresDb, { odds: 28_000n });
    const second = await createMatchWithMarket(db as PostgresDb, { odds: 18_000n });
    const placed = await betting.placeBet({
      actor: { ...actor, userId }, userId, idempotencyKey: key('it-acca'),
      payload: {
        type: 'MULTIPLE', stakeMinor: '100000', currency: 'IRT',
        legs: [
          { selectionId: first.selectionId, marketId: first.marketId, matchId: first.matchId, clientOddsScaled: '28000', marketVersion: 1, acceptOddsChange: false },
          { selectionId: second.selectionId, marketId: second.marketId, matchId: second.matchId, clientOddsScaled: '18000', marketVersion: 1, acceptOddsChange: false },
        ],
      },
    });
    expect(placed.bet.combinedOddsScaled).toBe(50_400n);       // 2.80 x 1.80 = 5.04
    expect(placed.bet.potentialPayoutMinor).toBe(504_000n);
    expect(placed.bet.legs.length).toBe(2);

    for (const m of [first.matchId, second.matchId]) {
      await db!.query(`update nova.matches set status = 'finished', home_score = 1, away_score = 0, finished_at = now() where id = $1`, [m]);
      await db!.query(
        `insert into nova.match_results (match_id, revision, status, home_score, away_score, provider, authoritative)
         values ($1, 1, 'finished', 1, 0, 'integration', true)`, [m],
      );
    }
    const settled = await settlementService.settle({
      betId: placed.bet.id, source: 'provider', idempotencyKey: key('it-acca-settle'), actorId: settlementActor,
    });
    expect(settled.plan.status).toBe('settled');
    expect(settled.result?.payoutMinor).toBe(504_000n);
  });

  it('exposes placement-time snapshots from the catalogue adapter', async () => {
    const { matchId, marketId, selectionId } = await createMatchWithMarket(db as PostgresDb, { odds: 33_000n });
    const snapshots = await catalog.getSelectionsForPlacement(matchId, [selectionId]);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.oddsScaled).toBe(33_000n);
    expect(snapshots[0]!.marketId).toBe(marketId);
    expect(snapshots[0]!.matchLabel).toContain('IT Home');
  });

  it('cashes out at the server price exactly once', async () => {
    await asRole(db as PostgresDb, 'admin', async () => {
      await db!.rpc('set_operation', { p_key: 'CASHOUT', p_enabled: true, p_actor: null, p_reason: 'integration test' });
    });
    const { userId } = await createUser(db as PostgresDb, { balanceMinor: 400_000n });
    const { matchId, marketId, selectionId } = await createMatchWithMarket(db as PostgresDb, { odds: 20_000n });
    const placed = await betting.placeBet({
      actor: { ...actor, userId }, userId, idempotencyKey: key('it-cashout'),
      payload: { type: 'SINGLE', stakeMinor: '100000', currency: 'IRT', legs: [{ selectionId, marketId, matchId, clientOddsScaled: '20000', marketVersion: 1, acceptOddsChange: false }] },
    });
    await db!.query(`update nova.selections set odds_scaled = 25000, odds_version = 2, odds_updated_at = now() where id = $1`, [selectionId]);

    const quote = await betting.getCashoutQuote(actor, placed.bet.id, userId);
    expect(quote.available).toBe(true);
    expect(quote.offerMinor).toBe(237_500n);        // 100,000 * 2.50 * (1 - 0.05)
    const accepted = await betting.acceptCashout(actor, {
      betId: placed.bet.id, quoteId: quote.quoteId!, userId, idempotencyKey: key('it-cashout-accept'),
    });
    expect(accepted.offerMinor).toBe(237_500n);
    expect((await wallet.getWallet(actor, userId, 'IRT'))?.balanceMinor).toBe(537_500n);
    // Accepting again is an idempotent replay: no second payout.
    const replay = await betting.acceptCashout(actor, {
      betId: placed.bet.id, quoteId: quote.quoteId!, userId, idempotencyKey: key('it-cashout-accept'),
    });
    expect(replay.replay).toBe(true);
    expect((await wallet.getWallet(actor, userId, 'IRT'))?.balanceMinor).toBe(537_500n);
    await asRole(db as PostgresDb, 'admin', async () => {
      await db!.rpc('set_operation', { p_key: 'CASHOUT', p_enabled: false, p_actor: null, p_reason: 'integration test done' });
    });
  });

  it('attributes a referred user and refuses self-referral', async () => {
    const affUser = await createUser(db as PostgresDb, { role: 'affiliate' });
    const code = `IT${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const created = await asRole(db as PostgresDb, 'service_role', async () =>
      affiliate.register({ userId: affUser.userId, code, displayName: 'Integration Affiliate', model: 'NON_NEGATIVE_35', rateBps: 3500 }));
    expect(created.code).toBe(code.toUpperCase());
    expect(created.status).toBe('pending');
    // Approval is an explicit admin action and is audited.
    const approved = await asRole(db as PostgresDb, 'admin', async () =>
      affiliate.setStatus({ affiliateId: created.id, status: 'approved', actorId: affUser.userId, reason: 'integration approval' }));
    expect(approved.status).toBe('approved');

    const player = await createUser(db as PostgresDb, {});
    const { attribution } = await affiliate.attachAttribution({ userId: player.userId, code });
    expect(attribution.affiliateId).toBe(created.id);
    expect(attribution.status).toBe('confirmed');

    // A second attribution is refused (first-click wins, immutable).
    await expect(affiliate.attachAttribution({ userId: player.userId, code })).rejects.toThrow(/ALREADY_ATTRIBUTED/);

    // Self-referral: the affiliate's own account cannot attribute to itself.
    await expect(affiliate.attachAttribution({ userId: affUser.userId, code })).rejects.toThrow(/SELF_REFERRAL/);
  });
});
