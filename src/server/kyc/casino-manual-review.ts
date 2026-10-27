import { z } from 'zod';

/**
 * Operator attestation only: the document stays with the operator outside
 * BetVima. No image, Telegram handle, link, passport number, or file reference
 * is accepted or transmitted to the application.
 *
 * Requires a verified admin AAL2 session and users.kyc permission in the route.
 * The click confirms the operator checked the actual ID, legal age, account
 * linkage and permission to retain the evidence externally.
 */
export const casinoManualIdentityReviewSchema = z.object({
  documentType: z.enum(['national_id', 'passport', 'drivers_license']),
  ageConfirmed: z.literal(true),
  identityConfirmed: z.literal(true),
  consentConfirmed: z.literal(true),
  externalCustodyConfirmed: z.literal(true),
}).strict();

export type CasinoManualIdentityReview = z.infer<typeof casinoManualIdentityReviewSchema>;
