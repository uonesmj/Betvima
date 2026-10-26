import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RTT4 single-command isolated staging', () => {
  it('passes bash syntax validation without running any server commands', () => {
    const path = resolve('scripts/casino/build-and-start-rtt4-isolated.sh');
    const checked = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
    expect(checked.status, checked.stderr).toBe(0);
  });

  it('has all required read-only guards before isolated process startup', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const script = fs.readFileSync(resolve('scripts/casino/build-and-start-rtt4-isolated.sh'), 'utf8');
    expect(script).toContain('RTT4_SOURCE_AUDIT_PASSED');
    expect(script).toContain('LIVE_CALLBACK_CHANGED');
    expect(script).toContain('PORT_3102_IN_USE');
    expect(script).toContain('RTT4_FINANCIAL_TESTS_PASSED');
    expect(script).toContain('LIVE_CALLBACK_UNCHANGED_PORT_3098');
    expect(script).not.toContain('systemctl reload nginx');
  });
});
