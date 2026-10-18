// Read-only classification: a known side/line is useful context, not a verified full outcome.
export function labelTier(label: string, marketTitle: string): 'named' | 'partial' | 'unresolved' {
  if (!/Unlabelled outcome #/i.test(label)) return 'named';
  const side = /\b(Over|Under|Exactly)\b/i.test(label);
  const line = /\bline\s*[+-]?\d+(?:\.\d+)?\b/i.test(label);
  if (side && line && /(?:Goals|Corners|Handicap|Minutes|Cards|Line)/i.test(marketTitle)) return 'partial';
  if (line && /Handicap/i.test(marketTitle) && !/\bDraw\b/i.test(label)) return 'partial';
  return 'unresolved';
}

