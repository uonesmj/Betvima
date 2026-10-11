/**
 * Guard for the static API-contract checker itself.
 *
 * `scripts/verify-api-contract.mjs` only helps if it still runs, still finds the routes and still
 * fails on a mismatch. This test executes it against the real tree (expecting a clean result) and
 * against a temporary tree containing a deliberate defect, so a broken checker cannot silently
 * pass forever.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(root, 'scripts/verify-api-contract.mjs');

function run(args: string[] = [], cwd = root, target = script): { code: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [target, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

describe('api contract checker', () => {
  it('passes on the real tree and reports what it scanned', () => {
    const { code, output } = run();
    expect(output).toMatch(/checked \d+ client API call\(s\) against \d+ routes/);
    expect(output).toMatch(/checked authorisation ordering in mutating handlers \(violations: 0\)/);
    expect(output).toMatch(/API CONTRACT OK/);
    expect(code).toBe(0);
  });

  it('fails when a mutation validates the body before it resolves the session', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'nova-contract-'));
    mkdirSync(join(scratch, 'scripts'), { recursive: true });
    mkdirSync(join(scratch, 'src/app/api/v1/admin/probe'), { recursive: true });
    writeFileSync(join(scratch, 'scripts/verify-api-contract.mjs'), readFileSync(script));
    writeFileSync(
      join(scratch, 'src/app/api/v1/admin/probe/route.ts'),
      [
        "import { withErrorHandling } from '@/lib/errors';",
        'export const POST = withErrorHandling(\'probe\', async (ctx, request: Request) => {',
        '  const body = await readJson(request, schema, ctx);',
        '  const { services } = await withAdmin(request, ctx, \'settings.edit\');',
        '  return new Response(String(body) + String(services));',
        '});',
      ].join('\n'),
    );
    // Run the copy that lives inside the scratch tree: the checker resolves its scan root from its
    // own file location, so executing the original would scan the real project again.
    const { code, output } = run([], scratch, join(scratch, 'scripts/verify-api-contract.mjs'));
    expect(output).toMatch(/validates the body before resolving the session/);
    expect(code).toBe(1);
    rmSync(scratch, { recursive: true, force: true });
  });
});
