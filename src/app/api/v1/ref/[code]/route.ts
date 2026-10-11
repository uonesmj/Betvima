import { NextResponse } from 'next/server';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { clientIpFromHeaders, hashSignal } from '@/server/utils/hash';
import { enforceRateLimit } from '@/server/http/request';
import { serverEnv } from '@/server/env';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

/**
 * Referral landing endpoint. Click tracking is server-side; the client receives the
 * affiliate's PUBLIC data only (code, display name, commission model) and a first-party
 * cookie that binds a later registration to this affiliate.
 */
const REFERRAL_COOKIE = 'nova_ref';
const REFERRAL_TTL_DAYS = 60;

export const GET = withErrorHandling('ref.landing', async (ctx, request: Request, params: { params: Promise<{ code: string }> }) => {
  const { code } = await params.params;
  const services = createServices();
  const affiliate = await services.affiliate.getByCode(code.toUpperCase());
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('to') ?? '/';
  if (!affiliate) {
    return NextResponse.json({ ok: false, error: { code: 'INVALID_REFERRAL_CODE', message: 'Referral code not found', messageKey: 'errors.INVALID_REFERRAL_CODE' } }, { status: 404 });
  }
  const ipHash = hashSignal(clientIpFromHeaders(request.headers) ?? 'unknown');
  // Fail-open by design (a click must not be lost because the limiter is unavailable) — but the
  // failure is logged so an operator can see that attribution traffic was accepted unthrottled.
  await enforceRateLimit(`ref:${ipHash}`, 60, 60).catch((error) => {
    logger.warn('ref.rate_limit_unavailable', { message: error instanceof Error ? error.message : String(error) });
  });
  let clickId: string | null = null;
  try {
    const click = await services.affiliate.recordClick({
      code: code.toUpperCase(), ipHash, userAgentHash: hashSignal(request.headers.get('user-agent') ?? 'unknown'),
      campaign: url.searchParams.get('utm_campaign') ?? undefined, landingUrl: redirectTo,
    });
    clickId = click.clickId;
  } catch {
    clickId = null;
  }
  const response = url.searchParams.get('json') === 'true'
    ? jsonOk({ affiliate: publicAffiliate(affiliate), clickId, referralWindowDays: REFERRAL_TTL_DAYS })
    : NextResponse.redirect(new URL(redirectTo, serverEnv().NEXT_PUBLIC_SITE_URL), { status: 302 });
  response.cookies.set(REFERRAL_COOKIE, affiliate.code, {
    path: '/', maxAge: REFERRAL_TTL_DAYS * 86_400, httpOnly: true, sameSite: 'lax',
    secure: serverEnv().isProduction,
  });
  if (clickId) response.headers.set('x-nova-click-id', clickId);
  void ctx;
  return response;
});

function publicAffiliate(affiliate: { code: string; displayName: string; commissionModel: string; status: string }) {
  return { code: affiliate.code, displayName: affiliate.displayName, commissionModel: affiliate.commissionModel, status: affiliate.status };
}
