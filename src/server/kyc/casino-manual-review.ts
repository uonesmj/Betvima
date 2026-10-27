import { z } from 'zod';

/**
 * Only an MFA-protected operator may attest to a real, inspected identity
 * document. This is not a customer self-attestation or a Telegram identity.
 * Provider, legal-age, country, AML and responsible-gaming gates are separate.
 */
export const casinoManualIdentityReviewSchema = z.object({
  documentType: z.enum(['national_id', 'passport', 'drivers_license']),
  reason: z.string().trim().min(8).max(500),
  telegramReference: z.string().trim().min(4).max(160),
  ageConfirmed: z.literal(true),
  identityConfirmed: z.literal(true),
  consentConfirmed: z.literal(true),
}).strict();

export type CasinoManualIdentityReview = z.infer<typeof casinoManualIdentityReviewSchema>;
