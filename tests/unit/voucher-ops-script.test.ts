import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

describe('voucher email recovery process safety', () => {
  const file = 'ops/hotfixes/restore_voucher_email_worker_20261013.py';
  it('is valid Python and only launches the notification worker after safe preflight', () => {
    const source = readFileSync(file, 'utf8');
    const python = spawnSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {
      input: source, encoding: 'utf8',
    });
    expect(python.status, python.stderr).toBe(0);
    for (const required of [
      'RESEND_AND_DB_CONFIG_VERIFIED',
      'UWALLET_READONLY_PROBE_COMPLETE',
      'NOTIFICATION_WORKER_ONLINE',
      'EXISTING_VOUCHER_EMAIL_QUEUE_READY_FOR_DELIVERY',
      'NO_PAYMENT_OR_WALLET_OPERATION_PERFORMED',
      'ROOT_REQUIRED',
    ]) {
      expect(source).toContain(required);
    }
    expect(source).not.toContain('createVoucher(');
    expect(source).not.toContain('activateVoucher(');
    expect(source).not.toContain('update nova.wallets');
  });
});
