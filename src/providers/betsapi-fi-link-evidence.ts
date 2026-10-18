/**
 * Verifiable, fail-closed bookmaker/Events identity evidence gate.
 * Similar team names or matching scores are candidates, never trusted links.
 * An independent operator/provider corroboration is required.
 */
import { compareBet365FixtureIdentity, type Bet365FixtureIdentity } from './betsapi-bet365-catalogue';

export interface FixtureLinkEvidence {
  bookmaker: Bet365FixtureIdentity;
  events: Bet365FixtureIdentity;
  corroboration: {
    source: 'provider_mapping' | 'operator_verified';
    reference: string;
    verifiedAt: string;
  } | null;
}
export interface FixtureLinkVerdict {
  candidate: boolean;
  verified: boolean;
  reasons: string[];
  bookmakerFixtureId: string;
  eventsProviderId: string;
}
export function evaluateBet365FixtureLink(evidence: FixtureLinkEvidence, now: Date): FixtureLinkVerdict {
  const comparison = compareBet365FixtureIdentity(evidence.bookmaker, evidence.events);
  const reasons = [...comparison.reasons];
  const proof = evidence.corroboration;
  if (!Number.isFinite(now.getTime())) reasons.push('INVALID_OBSERVATION_TIME');
  if (!proof) reasons.push('NO_INDEPENDENT_CORROBORATION');
  else {
    if (!/^[A-Za-z0-9:_./-]{8,160}$/.test(proof.reference)) reasons.push('INVALID_REFERENCE');
    const proofTime = Date.parse(proof.verifiedAt);
    if (!Number.isFinite(proofTime) || !Number.isFinite(now.getTime()) ||
      proofTime > now.getTime() + 60_000 || now.getTime() - proofTime > 24 * 3600_000) {
      reasons.push('STALE_CORROBORATION');
    }
  }
  return {
    candidate: comparison.candidate,
    verified: reasons.length === 0,
    reasons,
    bookmakerFixtureId: evidence.bookmaker.id,
    eventsProviderId: evidence.events.id,
  };
}
