/**
 * NOVA - LEG GRADING PIPELINE
 * Reads the authoritative result and grades every leg of a bet through the market rules engine.
 * Any missing/ambiguous fact stops settlement and routes to manual review.
 */
import { gradeSelection, marketRuleFor } from './market-rules';
import type { DomainAdapters } from './ports';
import type { Bet, LegGrade } from './types';

export interface GradedLegFull {
  selectionId: string;
  odds: bigint;
  grade: LegGrade;
  reason: string;
  authoritative: boolean;
}

export type GradingResult =
  | { kind: 'graded'; legs: GradedLegFull[]; resultRevision: number }
  | { kind: 'manual_review'; reason: string; legs: GradedLegFull[] };

export async function gradingPipeline(input: {
  adapters: DomainAdapters;
  bet: Bet;
  workerId: string;
}): Promise<GradingResult> {
  const { adapters, bet } = input;
  const legs: GradedLegFull[] = [];
  const matchIds = Array.from(new Set(bet.legs.map((l) => l.matchId)));
  const results = new Map<string, Awaited<ReturnType<DomainAdapters['settlement']['getMatchResult']>>>();
  for (const matchId of matchIds) {
    results.set(matchId, await adapters.settlement.getMatchResult(matchId));
  }
  for (const matchId of matchIds) {
    if (!results.get(matchId)) {
      return { kind: 'manual_review', reason: `NO_AUTHORITATIVE_RESULT:${matchId}`, legs: [] };
    }
  }

  let revision = 0;
  for (const leg of bet.legs) {
    const result = results.get(leg.matchId);
    if (!result) return { kind: 'manual_review', reason: `NO_AUTHORITATIVE_RESULT:${leg.matchId}`, legs: [] };
    if (
      result.authoritative !== true ||
      !result.provider ||
      !result.providerResultId
    ) {
      return {
        kind: 'manual_review',
        reason: `RESULT_PROVIDER_OWNERSHIP_OR_AUTHORITY_MISMATCH:${leg.matchId}`,
        legs: [],
      };
    }
    revision = Math.max(revision, result.revision);

    const market = await adapters.sports.getMarket(leg.marketId);
    const selection = await adapters.sports.getSelection(leg.selectionId);
    if (!market || !selection) {
      return { kind: 'manual_review', reason: `SELECTION_OR_MARKET_MISSING:${leg.selectionId}`, legs };
    }
    const rule = marketRuleFor(market.key) ?? marketRuleFor(market.type);
    if (!rule) return { kind: 'manual_review', reason: `NO_MARKET_RULE:${market.key}`, legs };

    const graded = gradeSelection({
      rule,
      selection: { code: selection.code, line: selection.line, participantType: selection.participantType },
      result,
      matchStatus: result.status === 'corrected' ? 'finished' : result.status,
    });
    legs.push({
      selectionId: leg.selectionId,
      odds: leg.oddsAtPlacement,
      grade: graded.grade,
      reason: graded.reason,
      authoritative: result.authoritative,
    });
  }

  if (legs.some((l) => l.grade === 'MANUAL_REVIEW' || l.grade === 'PENDING')) {
    return { kind: 'manual_review', reason: 'LEG_GRADING_INCOMPLETE', legs };
  }
  return { kind: 'graded', legs, resultRevision: revision };
}
