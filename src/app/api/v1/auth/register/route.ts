import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { ApiError, withErrorHandling } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { serverEnv } from '@/server/env';
import { clientIpFromHeaders } from '@/server/utils/hash';
import { verifyTurnstileToken } from '@/server/security/turnstile';
import { createServices } from '@/server/services/container';
import { publicRegistrationOutcome, registrationLogSummary } from '@/server/auth/registration-output';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  turnstileToken: z.string().trim().min(1).max(2048),
  ageConfirmed: z.literal(true),
  acceptTerms: z.literal(true),
  referralCode: z.string().trim().max(64).optional(),
  giftCode: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(16).optional(),
  currency: z.enum(['IRR', 'USD', 'EUR', 'GBP']).default('IRR'),
});

export const POST = withErrorHandling(
  'auth.register',
  async (ctx, request: Request) => {
    const env = serverEnv();

    await enforceRateLimit(
      `register:${clientIpFromHeaders(request.headers) ?? 'unknown'}`,
      5,
      900,
    );

    const input = await readJson(request, schema, ctx);

    await verifyTurnstileToken(input.turnstileToken, 'register');
    const pendingCookies: Array<{
      name: string;
      value: string;
      options?: Record<string, unknown>;
    }> = [];

    const client = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            const raw = request.headers.get('cookie');
            if (!raw) return [];

            return raw
              .split(';')
              .map((part) => {
                const index = part.indexOf('=');
                if (index < 0) return null;

                return {
                  name: part.slice(0, index).trim(),
                  value: decodeURIComponent(part.slice(index + 1).trim()),
                };
              })
              .filter(
                (
                  item,
                ): item is { name: string; value: string } =>
                  item !== null && item.name.length > 0,
              );
          },

          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      },
    );

    let attributionFromCookie: boolean | null = null;
    // The newest first-party referral is captured by the server through a
    // HttpOnly cookie. Never use old browser localStorage to override it.
    // Android's explicit embedded referralCode remains supported.
    const directReferral = input.referralCode?.trim().toUpperCase() ?? '';
    const giftCode = input.giftCode?.trim().toUpperCase() ?? '';
    const referralCookie = (() => {
      const match = /(?:^|;\\s*)nova_ref=([^;]+)/.exec(request.headers.get('cookie') ?? '');
      if (!match) return '';
      try {
        const code = decodeURIComponent(match[1] ?? '').trim().toUpperCase();
        return /^[A-Z0-9_-]{3,64}$/.test(code) ? code : '';
      } catch { return ''; }
    })();
    // Gift code is a separate optional input. Only when there is no partner
    // referral do we allow it to act as a legacy affiliate referral.
    const referralCode = directReferral || referralCookie || giftCode;
    const attributionViaGift = !directReferral && !referralCookie && Boolean(giftCode);


    const { data, error } = await client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          age_confirmed: input.ageConfirmed,
          accept_terms: input.acceptTerms,
          referral_code: referralCode || null,
          locale: input.locale || 'en',
          currency: input.currency,
        },
      },
    });

    if (error) {
      throw new ApiError(
        'BAD_REQUEST',
        error.message,
      );
    }

    const authenticated = Boolean(data.session);
    const emailConfirmationRequired = Boolean(
      data.user && !data.session,
    );

    if (data.user?.id && referralCode) {
      try {
        const services = createServices();
        // Native older versions send gift codes as referralCode, so the gift
        // lookup stays as backward compatibility ONLY when not cookie-bound.
        const canBeGift = attributionViaGift ||
          (Boolean(directReferral) && !referralCookie);
        let giftFound = false;
        if (canBeGift) {
          const result = await services.db.rpc<Record<string, unknown>>(
            'attach_gift_registration_code',
            {
              p_user_id: data.user.id,
              p_code: referralCode,
              p_ip_hash: clientIpFromHeaders(request.headers) ?? null,
              p_device: request.headers.get('user-agent') ?? null,
            },
          );
          giftFound = Boolean(result?.gift_code_found);
          if (giftFound) attributionFromCookie = Boolean(result?.attributed);
        }
        if (!giftFound) {
          const attribution = await services.affiliate.attachAttribution({
            userId: data.user.id,
            code: referralCode,
            ipHash: clientIpFromHeaders(request.headers) ?? undefined,
            deviceFingerprint: request.headers.get('user-agent') ?? undefined,
          });
          attributionFromCookie = Boolean(attribution.created);
        }
      } catch (failure) {
        attributionFromCookie = false;
        // No secrets or user identifiers in logs. Failures are observable;
        // registration remains successful rather than orphaning an account.
        console.warn('[auth.register.attribution_failed]',
          failure instanceof Error ? failure.name : 'unknown');
      }
    }
    console.log(
      '[auth.register.result]',
      JSON.stringify(registrationLogSummary({
        hasUser: Boolean(data.user),
        hasSession: Boolean(data.session),
        authenticated,
        emailConfirmationRequired,
        attributionAttempted: Boolean(referralCode),
        attributionFromCookie,
      })),
    );

    const response = NextResponse.json(
      {
        ok: true,
        data: publicRegistrationOutcome({ authenticated, emailConfirmationRequired, attributionFromCookie }),
      },
      {
        status: 201,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );

    for (const cookie of pendingCookies) {
      response.cookies.set(
        cookie.name,
        cookie.value,
        cookie.options as never,
      );
    }

    return response;
  },
);
