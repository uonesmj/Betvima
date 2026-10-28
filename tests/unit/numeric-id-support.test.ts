import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const load = (path: string) => readFileSync(path, 'utf8');

describe('Account numeric identifier is the stable, customer-facing support key', () => {
  const users = load('src/server/adapters/postgres/users.ts');
  const support = load('src/server/adapters/postgres/support.ts');
  const contracts = load('src/lib/ports/repositories.ts');
  const types = load('src/lib/types/admin.ts');
  it('matches numeric ID exactly, while continuing email, name and legacy internal key lookup', () => {
    expect(users).toContain("p.numeric_id::text = trim($1)");
    expect(users).toContain("p.email ilike '%' || $1 || '%'");
    expect(users).toContain("p.public_id ilike '%' || $1 || '%'");
    expect(users).toContain("numericId: toNum(r.numeric_id)");
    expect(users).toContain("numericId: toNum(row.numeric_id)");
    expect(types).toContain('publicId: string; numericId: number; email:');
  });
  it('uses real user numeric ID for ticket search and ticket list/detail, never a ticket-generated number', () => {
    expect(support).toContain('p.numeric_id as user_numeric_id');
    expect(support).toContain("p.numeric_id::text = ${numeric}");
    expect(support).toContain("userNumericId: row.user_numeric_id == null ? null : int(row.user_numeric_id)");
    expect(contracts).toContain('userNumericId: number | null;');
    expect(support).toContain('t.user_id');
  });
  it('provides a direct, permission-checked profile lookup even for players without a ticket', () => {
    const ui = load('src/components/admin/support-admin-client.tsx');
    expect(ui).toContain('/api/v1/admin/users?role=user,affiliate&pageSize=10&q=');
    expect(ui).toContain('/admin/users/');
    expect(ui).toContain('item.userNumericId?.toString()');
    expect(ui).not.toContain('Search subject, email, user ID...');
  });
  it('displays the own numeric ID in authenticated user support instead of the UUID/public code', () => {
    const ui = load('src/components/support/support-client.tsx');
    expect(ui).toContain("/api/v1/account/profile");
    expect(ui).toContain('result?.data?.profile?.numericId');
    expect(ui).toContain('supportNumericId');
  });
  it('does not change the internal immutable UUID needed for relationships, or reset user IDs', () => {
    const dossier = load('src/app/api/v1/admin/mobile/user-overview/[id]/route.ts');
    expect(dossier).toContain('numericId');
    expect(dossier).toContain('id: profile.id');
    expect(users).not.toContain('set numeric_id');
  });
});
