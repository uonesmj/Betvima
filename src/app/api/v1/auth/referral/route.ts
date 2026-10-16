import { withErrorHandling, jsonOk } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { enforceRateLimit, searchParams } from '@/server/http/request';
import { clientIpFromHeaders } from '@/server/utils/hash';

export const dynamic = 'force-dynamic';

/**
 * Read-only public referral validation before a player creates an account.
 * Do not expose affiliate identities, commission rates or referral statistics.
 * The actual attribution is still performed by auth.register on the server.
 */
export const GET = withErrorHandling('auth.referral.validate', async (_ctx, request: Request) => {
  await enforceRateLimit(`referral-check:${clientIpFromHeaders(request.headers) ?? 'unknown'}`, 20, 900);
  const code = (searchParams(request).get('code') ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,64}$/.test(code)) {
    return jsonOk({ valid: false });
  }

  const services = createServices();
  const hit = await services.db.queryOne<{ valid: boolean }>(
    `select (
      exists (
        select 1
          from nova.affiliate_registration_gift_codes g
          join nova.affiliates a on a.id = g.affiliate_id
         where upper(g.code) = $1 and g.is_active = true
           and a.status = 'approved'
      ) or exists (
        select 1 from nova.affiliates a
         where a.status = 'approved'
           and (upper(a.code) = $1 or upper(a.slug) = $1)
      ) or exists (
        select 1
          from nova.affiliate_links l
          join nova.affiliates a on a.id = l.affiliate_id
         where upper(l.code) = $1 and l.is_active = true
           and a.status = 'approved'
      )
    ) as valid`,
    [code],
  );
  return jsonOk({ valid: hit?.valid === true });
});
