import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

describe('voucher email recovery process safety', () => {
  const file = 'ops/hotfixes/restore_voucher_email_worker_20261013.py';
  it('preserves private PM2 startup logs and explains boot failures without exposing payment credentials', () => {
    const source = readFileSync('ops/hotfixes/restore_voucher_email_worker_diagnostic_20261013.py','utf8');
    const syntax = spawnSync('python3', ['-c', 'import ast,sys;ast.parse(sys.stdin.read())'], {
      input: source, encoding:'utf8',
    });
    expect(syntax.status, syntax.stderr).toBe(0);
    for (const marker of [
      'TSX_RUNTIME_PRECHECK_PASS',
      'BOOT_DIAGNOSIS',
      'PM2_BOOT_STATUS',
      'PM2_EXIT_CODE',
      'NOTIFICATION_WORKER_ONLINE',
      'NOVA_WORKER_ONCE',
      'os.chmod(f, 0o600)',
    ]) expect(source).toContain(marker);
    expect(source).not.toContain('activateVoucher(');
    expect(source).not.toContain('createVoucher(');
  });
  it('starts notification with isolated PM2 environment and pinned node tsx command', () => {
    const content = readFileSync(
      'ops/hotfixes/restore_voucher_email_worker_pinned_node_20261013.py',
      'utf8'
    );
    const result = spawnSync('python3',
      ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'],
      { input: content, encoding: 'utf8' }
    );
    expect(result.status, result.stderr).toBe(0);
    for(const marker of [
      '"--interpreter", "none"',
      '"--", "--import", "tsx"',
      '"NODE_ENV"',
      '"NOVA_WORKER_ONCE"',
      'PM2_REGISTERED_COUNT',
      'PM2_BOOT_STATUS',
      'PM2_RESTARTS',
      'NOTIFICATION_WORKER_ONLINE',
      'not k.startswith(("PM2_","NODE_"))',
    ]) expect(content).toContain(marker);
    expect(content).not.toContain('command("delete", NAME)');
    expect(content).not.toContain('createVoucher(');
    expect(content).not.toContain('activateVoucher(');
  });
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
