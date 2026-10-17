import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const nginx = readFileSync(join(process.cwd(), 'deploy/nginx/nova.conf'), 'utf8');
const attachmentApi = readFileSync(join(process.cwd(), 'src/server/support/attachments.ts'), 'utf8');

describe('support attachment reverse-proxy limit', () => {
  it('keeps the server-side 10 MiB validation', () => {
    expect(attachmentApi).toContain('10 * 1024 * 1024');
  });

  it('allows multipart overhead on the narrowly scoped support messages route', () => {
    expect(nginx).toMatch(/location ~ \^\/api\/v1\/support\/.*\/messages\/\?\$ \{\s+client_max_body_size 11m;/);
    expect(nginx).toContain('client_max_body_size 8m;');
    expect(nginx).toContain('client_max_body_size 1m;');
  });

  it('does not raise the payment or authentication body limit', () => {
    const block = nginx.split('# Money-mutating endpoints get their own (slow) bucket.')[1];
    expect(block).not.toContain('client_max_body_size 11m');
  });
});
