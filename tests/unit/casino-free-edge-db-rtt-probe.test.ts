import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('no-cost Supabase Edge DB latency experiment safety', () => {
  const source = readFileSync(
    resolve('supabase/functions/betvima-db-rtt-probe/index.ts'), 'utf8',
  );

  it('only executes a hard-coded, read-only SELECT 1', () => {
    expect(source).toContain('SELECT 1 AS probe');
    expect(source).not.toMatch(/sql`(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)/i);
    expect(source).not.toContain('softaggregator_callback_receipts');
    expect(source).not.toContain('post_wallet_entry');
    expect(source).not.toContain('casinoRealMoneyUserAllowed');
  });

  it('avoids request-defined SQL and limits the query count', () => {
    expect(source).toContain('for (let i = 0; i < 6; i++)');
    expect(source).toContain("request.method !== 'POST'");
    expect(source).not.toContain('request.json()');
    expect(source).not.toContain('request.text()');
  });

  it('never returns database secrets or user wallet data', () => {
    expect(source).toContain('wallet_modified: false');
    expect(source).toContain("error: 'DATABASE_PROBE_UNAVAILABLE'");
    expect(source).not.toContain('JSON.stringify({ error: error');
    expect(source).not.toContain('JSON.stringify({ error: err');
  });
});
