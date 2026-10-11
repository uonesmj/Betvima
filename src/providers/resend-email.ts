import type { NotificationMessage, NotificationProvider, ProviderResult, ProviderStatus } from '@/lib/ports/providers';
import { serverEnv } from '@/server/env';

export class ResendEmailProvider implements NotificationProvider {
  readonly name = 'resend';
  readonly channel = 'email' as const;
  readonly configured = true;

  async health(): Promise<ProviderStatus> {
    const env = serverEnv();
    return {
      provider: this.name,
      category: 'notifications',
      configured: Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL),
      enabled: Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL),
      reachable: null,
      lastError: null,
      lastSuccessAt: null,
      requiredEnv: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
      notes: 'Resend email provider configured through the Resend REST API.',
    };
  }

  async send(message: NotificationMessage): Promise<ProviderResult<{ providerMessageId: string | null }>> {
    const env = serverEnv();

    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      return {
        ok: false,
        value: null,
        errorCode: 'RESEND_NOT_CONFIGURED',
        errorMessage: 'RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.',
        retryable: false,
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL,
          to: [message.to],
          subject: message.subject ?? 'NOVA',
          text: message.body,
        }),
        cache: 'no-store',
      });

      const text = await response.text();
      let payload: { id?: string; message?: string; name?: string } = {};

      try {
        payload = JSON.parse(text) as typeof payload;
      } catch {}

      if (!response.ok) {
        return {
          ok: false,
          value: null,
          errorCode: payload.name ?? `RESEND_HTTP_${response.status}`,
          errorMessage: payload.message ?? `Resend request failed (${response.status}).`,
          retryable: response.status >= 500 || response.status === 429,
        };
      }

      return {
        ok: true,
        value: {
          providerMessageId: payload.id ?? null,
        },
        errorCode: undefined,
        errorMessage: undefined,
        retryable: false,
      };
    } catch (error) {
      return {
        ok: false,
        value: null,
        errorCode: 'RESEND_REQUEST_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  }
}
