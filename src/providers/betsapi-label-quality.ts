// Diagnostic-only classification. Never infer an executable selection from an odds price.
export type BetsApiLabelTier = 'named' | 'partial' | 'unresolved';

const missingIdentity = /\b(?:Unlabelled|Unlabeled)\s+outcome\s*#/i;
const genericSelection = /^(?:Selection|Outcome|Option)(?:\s*\((?:Yes|No)\))?$/i;
const numericLine = /\bline\s*[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?![\d.])/i;

export function labelTier(label: string, marketTitle: string): BetsApiLabelTier {
  const text = (label ?? '').trim();
  if (!text || genericSelection.test(text)) return 'unresolved';
  if (!missingIdentity.test(text)) return 'named';

  // A partial label contains useful upstream context, but it is NOT a named offer.
  const side = /\b(?:Over|Under|Exactly)\b/i.test(text);
  const line = numericLine.test(text);
  const totalsMarket = /(?:Goals?|Corners?|Handicap|Minutes?|Cards?|Line)/i.test(marketTitle);
  if (side && line && totalsMarket) return 'partial';

  // For a 2-way handicap, an explicit team side plus line is partial context.
  // Draw/tie and generic Selection cannot be interpreted as an eligible handicap side.
  const teamPrefix = text.split(/\s*[·•]\s*/)[0]?.trim() ?? '';
  if (line && /Handicap/i.test(marketTitle) &&
      teamPrefix.length > 0 &&
      !/^(?:Draw|Tie|Selection|Outcome|Option|Over|Under|Exactly)$/i.test(teamPrefix))
    return 'partial';
  return 'unresolved';
}
