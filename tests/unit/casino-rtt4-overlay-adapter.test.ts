import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RTT4 safe production release adapter', () => {
  it('parses without accessing the live database or Nginx', () => {
    const path = resolve('scripts/casino/prepare-rtt4-from-live-rtt3.py');
    const checked = spawnSync('python3', [
      '-c', 'import ast,pathlib,sys;ast.parse(pathlib.Path(sys.argv[1]).read_text())', path,
    ], { encoding: 'utf8' });
    expect(checked.status, checked.stderr).toBe(0);
  });
});
