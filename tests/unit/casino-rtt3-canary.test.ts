import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve('scripts/casino/controlled-rtt3-canary.py');

function python(source: string) {
  return spawnSync('python3', ['-c', source, script], { encoding: 'utf8' });
}

describe('RTT3 callback-only temporary canary', () => {
  it('parses without attempting to change the server', () => {
    const result = python(
      'import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())',
    );
    expect(result.status, result.stderr).toBe(0);
  });

  it('targets only the Nginx callback location; other routes are excluded', () => {
    const result = python(`
import runpy, sys, re
m = runpy.run_path(sys.argv[1], run_name='unit_test')
conf = """server {
  location ^~ /api/webhooks/softaggregator {
    include /etc/nginx/snippets/betvima-casino-cloudflare-ips.conf;
    deny all;
    proxy_pass http://127.0.0.1:3098;
  }
  location / { proxy_pass http://127.0.0.1:3007; }
}
"""
match, port = m['locate_route'](conf)
assert port == 3098
after = conf[:match.start(2)] + '3101' + conf[match.end(2):]
assert 'proxy_pass http://127.0.0.1:3101;' in after
assert 'proxy_pass http://127.0.0.1:3007;' in after
assert m['locate_route'](after)[1] == 3101
try:
  m['locate_route'](conf + conf)
except SystemExit:
  pass
else:
  raise AssertionError('ambiguous callback blocks must fail closed')
`);
    expect(result.status, result.stderr).toBe(0);
  });
});
