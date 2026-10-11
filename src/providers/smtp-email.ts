import nodemailer from 'nodemailer';
import type { NotificationMessage, NotificationProvider, ProviderResult, ProviderStatus } from '@/lib/ports/providers';
import { serverEnv } from '@/server/env';

export class SmtpEmailProvider implements NotificationProvider {
  readonly name = 'smtp';
  readonly channel = 'email' as const;
  readonly configured = true;

  private readonly env = serverEnv();
  private readonly transporter = nodemailer.createTransport(this.env.SMTP_URL);

  async health(): Promise<ProviderStatus> {
    try {
      await this.transporter.verify();
      return {
        provider: this.name,
        category: 'notifications',
        configured: true,
        enabled: true,
        reachable: true,
        lastError: null,
        lastSuccessAt: null,
        requiredEnv: ['NOTIFY_EMAIL_PROVIDER', 'SMTP_URL'],
        notes: 'SMTP email provider is configured and reachable.',
      };
    } catch (error) {
      return {
        provider: this.name,
        category: 'notifications',
        configured: true,
        enabled: true,
        reachable: false,
        lastError: error instanceof Error ? error.message : String(error),
        lastSuccessAt: null,
        requiredEnv: ['NOTIFY_EMAIL_PROVIDER', 'SMTP_URL'],
        notes: 'SMTP provider is configured but currently unreachable.',
      };
    }
  }

  async send(message: NotificationMessage): Promise<ProviderResult<{ providerMessageId: string | null }>> {
    try {
      const info = await this.transporter.sendMail({
        from: this.env.SMTP_FROM,
        to: message.to,
        subject: message.subject ?? undefined,
        text: message.body,
      });

      return {
        ok: true,
        value: { providerMessageId: String(info.messageId ?? '') || null },
        errorCode: undefined,
        errorMessage: undefined,
        retryable: false,
      };
    } catch (error) {
      return {
        ok: false,
        value: null,
        errorCode: 'SMTP_SEND_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  }
}
