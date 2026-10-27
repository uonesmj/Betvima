import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { casinoManualIdentityReviewSchema } from '../../src/server/kyc/casino-manual-review';
import { isApprovedAdminOrigin } from '../../src/server/security/approved-admin-origin';

const valid = {
  documentType: 'passport',
  ageConfirmed: true,
  identityConfirmed: true,
  consentConfirmed: true,
  externalCustodyConfirmed: true,
};
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('manual casino approval, external evidence custody', () => {
  it('accepts an operator attestation without document bytes', () => {
    expect(casinoManualIdentityReviewSchema.safeParse(valid).success).toBe(true);
  });
  it('requires review of age, identity, consent and private external custody', () => {
    for (const key of ['ageConfirmed','identityConfirmed','consentConfirmed','externalCustodyConfirmed']) {
      expect(casinoManualIdentityReviewSchema.safeParse({ ...valid, [key]: false }).success).toBe(false);
      expect(casinoManualIdentityReviewSchema.safeParse({ ...valid, [key]: undefined }).success).toBe(false);
    }
  });
  it('rejects injected document uploads, Telegram identifiers and KYC flags', () => {
    expect(casinoManualIdentityReviewSchema.safeParse({ ...valid, documentPath: 'public/id.png' }).success).toBe(false);
    expect(casinoManualIdentityReviewSchema.safeParse({ ...valid, telegramReference: '@handle' }).success).toBe(false);
    expect(casinoManualIdentityReviewSchema.safeParse({ ...valid, kycStatus: 'verified' }).success).toBe(false);
    expect(casinoManualIdentityReviewSchema.safeParse({ ...valid, documentType: 'unknown' }).success).toBe(false);
  });
  it('never accepts uploaded files at the manual-approval endpoint', () => {
    const code = source('src/app/api/v1/admin/casino-approvals/[id]/route.ts');
    expect(code).toContain('readJson(request, casinoManualIdentityReviewSchema');
    expect(code).not.toContain('request.formData()');
    expect(code).not.toContain('storage.upload(');
    expect(code).not.toContain('createSignedUrl(');
    expect(code).toContain("evidenceSource: 'external_custody'");
    expect(code).toContain('for update');
    expect(code).toContain("set_config('nova.user_role'");
    expect(code).toContain("audit_event");
  });
  it('validates the operator POST against configured public origin, not proxy HTTP origin', () => {
    expect(isApprovedAdminOrigin('https://betvima.com', 'https://betvima.com')).toBe(true);
    expect(isApprovedAdminOrigin('https://www.betvima.com', 'https://betvima.com')).toBe(true);
    expect(isApprovedAdminOrigin(null, 'https://betvima.com')).toBe(false);
    for (const incoming of [
      'http://betvima.com',
      'http://127.0.0.1:3010',
      'https://evil.example',
      'https://betvima.com.evil.example',
      'https://betvima.com:444',
      'https://betvima.com/path',
      'https://betvima.com@evil.example',
      'null',
    ]) {
      expect(isApprovedAdminOrigin(incoming, 'https://betvima.com')).toBe(false);
    }
    const route = source('src/app/api/v1/admin/casino-approvals/[id]/route.ts');
    expect(route).toContain('isApprovedAdminOrigin(origin, serverEnv().NEXT_PUBLIC_SITE_URL)');
    expect(route).toContain("withAdmin(request, ctx, 'users.kyc')");
    expect(route).not.toContain("origin !== new URL(request.url).origin");
  });

  it('opens the document review visibly on mobile and shows approval failures in the dialog', () => {
    const client = source('src/components/admin/casino-approvals-client.tsx');
    expect(client).toContain('role="dialog" aria-modal="true"');
    expect(client).toContain("dialogRef.current?.focus()");
    expect(client).toContain("role=\"alert\">{notice}");
    expect(client).toContain("disabled={busy || !documentType}");
    expect(client).toContain("window.confirm(");
    expect(client).toContain("await apiRequest('/api/v1/admin/casino-approvals/'");
  });

  it('persists a truthful external-custody record and retains earlier private-upload records', () => {
    const migration = source('supabase/migrations/0219_casino_kyc_external_custody.sql');
    expect(migration).toContain("evidence_source = 'external_custody'");
    expect(migration).toContain('document_path is null');
    expect(migration).toContain("evidence_source = 'private_upload'");
    expect(migration).toContain('document_path is not null');
    expect(migration).toContain('revoke all on nova.kyc_submissions from anon, authenticated');
  });
  it('admin does not render a file input or construct multipart data', () => {
    const client = source('src/components/admin/casino-approvals-client.tsx');
    expect(client).not.toContain('type="file"');
    expect(client).not.toContain('new FormData()');
    expect(client).toContain("json: {");
    expect(client).toContain("externalCustodyConfirmed: true");
  });
});
