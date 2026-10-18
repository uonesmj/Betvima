/**
 * Show only explicitly named Bet365 headline markets. Specialty in-play markets
 * such as "3rd Goal", "6th Goal" or next-corner are valid offers but must NOT
 * masquerade as full-time odds when primary markets are suspended.
 */
export interface BetsPreviewMarket {
  key: string;
  title: string;
  selections: Array<{ id: string; label: string; decimal: string }>;
}

function headlinePriority(title: string): number | null {
  const name = title.toLowerCase().trim().replace(/\s+/g, ' ');
  if (/^(?:full ?time|ft|match) (?:result|winner|outcome)$|^(?:1x2|3.way result|match betting|money ?line|moneyline)$/.test(name)) return 0;
  if (/^(?:to win|winner|2.way result|two.way result|game winner)$/.test(name)) return 1;
  if (/^double chance(?: \(.*\))?$/.test(name)) return 2;
  if (/^(?:both teams to score|btts|both teams score)$/.test(name)) return 3;
  if (/^(?:match goals|total goals|goals over\/under|goals over under|total points|match total|over\/under|over under)$/.test(name)) return 4;
  return null;
}

const explicit = (label: string): boolean =>
  Boolean(label.trim()) &&
  !/\b(?:unlabelled|unlabeled)\s+outcome\b/i.test(label) &&
  !/^(?:selection|outcome|option)(?:\s*\((?:yes|no)\))?$/i.test(label.trim());

export function pickHeadlineMarket(markets: BetsPreviewMarket[]): BetsPreviewMarket | null {
  const candidates = markets.flatMap((m, index) => {
    const priority = headlinePriority(m.title);
    if (priority == null) return [];
    const selections = m.selections.filter(s =>
      Boolean(s.id) && Number.isFinite(Number(s.decimal)) &&
      Number(s.decimal) > 1 && explicit(s.label),
    );
    // Single offers or one-sided totals do not represent a useful headline.
    if (selections.length < 2) return [];
    if (priority === 4 && !(
      selections.some(s => /^over\b/i.test(s.label.trim())) &&
      selections.some(s => /^under\b/i.test(s.label.trim()))
    )) return [];
    return [{ ...m, selections, priority, index }];
  });
  candidates.sort((a, b) => a.priority - b.priority || a.index - b.index);
  const match = candidates[0];
  return match ? { key: match.key, title: match.title, selections: match.selections } : null;
}
