/**
 * Response serialisers shared by route handlers.
 *
 * The global bigint serialiser (`src/server/json.ts`) already renders money as decimal strings,
 * but bets are the one payload where the UI needs *stable key names* for legs as well, so the
 * conversion is explicit here and shared instead of duplicated per route.
 */
export interface SerializableBet {
  stakeMinor: bigint;
  potentialPayoutMinor: bigint;
  settledPayoutMinor: bigint | null;
  netResultMinor: bigint | null;
  combinedOddsScaled: bigint;
  legs: { oddsAtPlacementScaled: bigint; acceptedOddsScaled: bigint | null }[];
}

/** Bet -> wire format (every money/odds field becomes a decimal string). */
export function serializeBet<T extends SerializableBet>(bet: T) {
  return {
    ...bet,
    stakeMinor: bet.stakeMinor.toString(),
    potentialPayoutMinor: bet.potentialPayoutMinor.toString(),
    settledPayoutMinor: bet.settledPayoutMinor === null ? null : bet.settledPayoutMinor.toString(),
    netResultMinor: bet.netResultMinor === null ? null : bet.netResultMinor.toString(),
    combinedOddsScaled: bet.combinedOddsScaled.toString(),
    legs: bet.legs.map((leg) => ({
      ...leg,
      oddsAtPlacementScaled: leg.oddsAtPlacementScaled.toString(),
      acceptedOddsScaled: leg.acceptedOddsScaled === null ? null : leg.acceptedOddsScaled.toString(),
    })),
  };
}
