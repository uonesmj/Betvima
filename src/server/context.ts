import type { ActorContext } from '@/lib/ports/db';

/**
 * Actor contexts are ALWAYS constructed server-side.
 * `serviceRoleContext` is used by workers and internal services: it never carries a
 * client-supplied identity and is never derived from request input.
 */
export const serviceRoleContext: ActorContext = {
  userId: null, role: 'service_role', adminId: null, ip: null, userAgent: null, correlationId: null,
};

export const anonymousContext: ActorContext = {
  userId: null, role: 'anon', adminId: null, ip: null, userAgent: null, correlationId: null,
};
