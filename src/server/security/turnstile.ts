import { ApiError } from '@/lib/errors';
import { serverEnv } from '@/server/env';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type TurnstileAction = 'login' | 'register' | 'forgot-password';

type TurnstileResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
};

export async function verifyTurnstileToken(
  token: string,
  expectedAction: TurnstileAction,
): Promise<void> {
  const env = serverEnv();
  const secret = env.TURNSTILE_SECRET_KEY.trim();

  if (!secret) {
    console.error('[TURNSTILE_CONFIG_ERROR] secret key is not configured');
    throw new ApiError(
      'SERVICE_UNAVAILABLE',
      'Bot verification is temporarily unavailable',
    );
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);

  let response: Response;
  let payload: TurnstileResponse | null = null;

  try {
    response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    payload = (await response.json().catch(() => null)) as TurnstileResponse | null;
  } catch (error) {
    console.error('[TURNSTILE_VERIFY_ERROR]', error instanceof Error ? error.message : String(error));
    throw new ApiError(
      'SERVICE_UNAVAILABLE',
      'Bot verification is temporarily unavailable',
    );
  }

  if (!response.ok || !payload?.success || payload.action !== expectedAction) {
    console.warn(
      '[TURNSTILE_VERIFY_REJECTED]',
      JSON.stringify({
        status: response.status,
        success: Boolean(payload?.success),
        action: payload?.action ?? null,
        expectedAction,
        errors: payload?.['error-codes'] ?? [],
        hostname: payload?.hostname ?? null,
      }),
    );
    throw new ApiError(
      'VALIDATION_FAILED',
      'Please complete the verification and try again.',
    );
  }
}
