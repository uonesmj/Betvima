import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('isolated casino callback production adapter', () => {
  it('parses as Python without executing or accessing the live server', () => {
    const path = resolve('scripts/casino/prepare-fast-callback-candidate.py');
    const result = spawnSync(
      'python3',
      ['-c', 'import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())', path],
      { encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
  });
});
