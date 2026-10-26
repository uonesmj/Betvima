import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const relative = 'scripts/casino/check-edge-migration-preflight.py';

describe('Supabase Edge financial migration preflight is observational', () => {
  const source = readFileSync(resolve(relative), 'utf8');

  it('parses cleanly as Python without executing it', () => {
    const checked = spawnSync('python3', [
      '-c', 'import ast,pathlib,sys;ast.parse(pathlib.Path(sys.argv[1]).read_text())',
      resolve(relative),
    ], { encoding: 'utf8' });
    expect(checked.status, checked.stderr).toBe(0);
  });

  it('fails closed unless the live callback still routes to 3098', () => {
    expect(source).toContain("if ports[0] != '3098':");
    expect(source).toContain("stop('UNEXPECTED_LIVE_CALLBACK_UPSTREAM')");
    expect(source).toContain("stop('UNSIGNED_CALLBACK_NOT_REJECTED')");
  });

  it('does not perform database, wallet, or Nginx writes', () => {
    expect(source).not.toContain('subprocess.');
    expect(source).not.toContain('os.system');
    expect(source).not.toContain("method='POST'");
    expect(source).not.toContain('write_text(');
    expect(source).not.toContain('write_bytes(');
    expect(source).toContain("NGINX_DB_WALLET_PM2_MODIFIED=false");
    expect(source).toContain('CASINO_EDGE_MIGRATION_PREFLIGHT_PASSED');
  });

  it('prints only environment variable presence, never values', () => {
    expect(source).toContain('DOTENV_PRESENCE_ONLY_NOT_RUNTIME_VALUES=true');
    expect(source).toContain("str(key in env_names).lower()");
    expect(source).not.toContain("os.environ[");
  });
});
