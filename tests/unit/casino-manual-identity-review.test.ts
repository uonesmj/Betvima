import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { casinoManualIdentityReviewSchema } from '../../src/server/kyc/casino-manual-review';

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
