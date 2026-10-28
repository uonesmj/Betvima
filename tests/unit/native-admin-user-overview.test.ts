import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = () => readFileSync('src/app/api/v1/admin/mobile/user-overview/[id]/route.ts', 'utf8');
const password = () => readFileSync('src/app/api/v1/admin/users/[id]/password/route.ts', 'utf8');
const userList = () => readFileSync('src/app/api/v1/admin/users/route.ts', 'utf8');

describe('native admin user dossier contract', () => {
  it('enforces server-side admin scope and a validated target user', () => {
    expect(read()).toContain("withAdmin(request, ctx, 'users.view')");
    expect(read()).toContain("if (!uuid.safeParse(id).success)");
    expect(read()).toContain("role::text in ('user','affiliate')");
    expect(read()).not.toContain('serviceRoleClient');
  });

  it('groups historical money in its true currency, no live vendor conversion', () => {
    const s = read();
    expect(s).toContain('group by type::text, currency');
    expect(s).toContain('group by currency order by currency');
    expect(s).toContain('customerNetMinor');
    expect(s).toContain('siteNetMinor');
    expect(s).not.toMatch(/getUsdIrtRate|getAdminUsdRates|convertAdminAmountToUsd/);
  });

  it('separates bonuses and online hint from account status, and does not guess registration source', () => {
    const s = read();
    expect(s).toContain('nova.bonus_grants');
    expect(s).toContain('recentlyActive');
    expect(s).toContain("registrationSource = ['android','app']");
    expect(s).toContain(": 'unknown'");
    expect(s).not.toContain('update nova.profiles');
  });

  it('password reset preserves permission, scope, audit and throttling', () => {
    const s = password();
    expect(s).toContain("requireAdmin(user, 'users.password_reset')");
    expect(s).toContain("enforceRateLimit");
    expect(s).toContain("['user','affiliate'].includes(profile.role)");
    expect(s).toContain("action: 'account.password_reset.admin'");
    expect(s).not.toContain("return jsonOk({ success: true });");
  });

  it('supports oldest and newest without unauthorized query fragments', () => {
    expect(userList()).toContain("params.get('sort') === 'oldest' ? 'asc' : 'desc'");
  });
});
