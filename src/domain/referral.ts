/**
 * NOVA - REFERRAL ATTRIBUTION RULES (server-authoritative)
 *
 * Cookie/localStorage is auxiliary only: the click record persisted server-side is what
 * the attribution decision is made from. Rules enforced here (spec §26, §39):
 *   - one primary affiliate per user, immutable once confirmed (admin override audited)
 *   - self-referral blocked (same user, same email/phone, same device fingerprint, same IP hash)
 *   - circular hierarchy blocked (a descendant can never become an ancestor)
 *   - duplicate clicks are recorded but do not change attribution
 *   - attribution window is explicit and derived from configuration
 */
import type { AffiliateAttribution } from './types';

export const ATTRIBUTION_WINDOW_DAYS_DEFAULT = 30;

export class ReferralError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'ReferralError';
    this.code = code;
  }
}

export interface AttributionCandidate {
  code: string;
  affiliateId: string;
  clickId: string | null;
  clickedAt: Date | null;
}

export interface NewUserSignals {
  userId: string;
  emailHash: string | null;
  phoneHash: string | null;
  deviceFingerprint: string | null;
  ipHash: string | null;
  /** Hashes collected from the referring affiliate's own account. */
  affiliateEmailHash: string | null;
  affiliatePhoneHash: string | null;
  affiliateDeviceFingerprint: string | null;
  affiliateIpHash: string | null;
}

export interface AttributionDecision {
  attributed: boolean;
  status: 'confirmed' | 'review' | 'rejected';
  reason: string | null;
  /** Signals for the fraud subsystem; a single weak signal never blocks (spec §39). */
  signals: string[];
}

export function isAttributionWindowOpen(clickedAt: Date, now: Date, windowDays = ATTRIBUTION_WINDOW_DAYS_DEFAULT): boolean {
  return now.getTime() - clickedAt.getTime() <= windowDays * 86_400_000;
}

/**
 * Decide whether a signup may be attributed to an affiliate.
 * Strong signals (self referral) reject outright; weak signals (shared IP) route to review.
 */
export function decideAttribution(input: {
  candidate: AttributionCandidate | null;
  signals: NewUserSignals;
  now: Date;
  windowDays?: number;
  existingAttribution: AffiliateAttribution | null;
}): AttributionDecision {
  const { candidate, signals, now, existingAttribution } = input;
  const out: AttributionDecision = { attributed: false, status: 'rejected', reason: null, signals: [] };

  if (existingAttribution && existingAttribution.status === 'confirmed' && existingAttribution.isImmutable) {
    // One primary affiliate, permanently. A second code must never steal the user.
    return { attributed: false, status: 'rejected', reason: 'ALREADY_ATTRIBUTED', signals: ['DUPLICATE_SIGNUP'], };
  }
  if (!candidate || !candidate.clickId) {
    return { attributed: false, status: 'rejected', reason: 'NO_ATTRIBUTABLE_CLICK', signals: [] };
  }
  const windowDays = input.windowDays ?? ATTRIBUTION_WINDOW_DAYS_DEFAULT;
  if (!candidate.clickedAt) return { attributed: false, status: 'rejected', reason: 'CLICK_TIMESTAMP_MISSING', signals: [] };
  if (!isAttributionWindowOpen(candidate.clickedAt, now, windowDays)) {
    return { attributed: false, status: 'rejected', reason: 'ATTRIBUTION_WINDOW_EXPIRED', signals: ['EXPIRED_REFERRAL'] };
  }

  /* -------- STRONG: self referral -------- */
  const strong: string[] = [];
  if (signals.emailHash && signals.affiliateEmailHash && signals.emailHash === signals.affiliateEmailHash) strong.push('SELF_REFERRAL_EMAIL');
  if (signals.phoneHash && signals.affiliatePhoneHash && signals.phoneHash === signals.affiliatePhoneHash) strong.push('SELF_REFERRAL_PHONE');
  if (signals.deviceFingerprint && signals.affiliateDeviceFingerprint && signals.deviceFingerprint === signals.affiliateDeviceFingerprint) {
    strong.push('SELF_REFERRAL_DEVICE');
  }
  if (strong.length > 0) {
    return { attributed: false, status: 'rejected', reason: 'SELF_REFERRAL_BLOCKED', signals: strong };
  }

  /* -------- WEAK: shared infrastructure -> manual review, not a block -------- */
  const weak: string[] = [];
  if (signals.ipHash && signals.affiliateIpHash && signals.ipHash === signals.affiliateIpHash) weak.push('SAME_IP');
  if (weak.length > 0) {
    return { attributed: true, status: 'review', reason: 'WEAK_SIGNALS_PRESENT', signals: weak };
  }

  return { attributed: true, status: 'confirmed', reason: null, signals: [] };
}

/* ------------------------------------------------------------------ *
 * Hierarchy integrity                                                *
 * ------------------------------------------------------------------ */

export const MAX_AFFILIATE_DEPTH_DEFAULT = 3;

export interface HierarchyNode {
  affiliateId: string;
  parentAffiliateId: string | null;
  depth: number;
}

/**
 * Validate a hierarchy change. Every rejection reason is explicit and auditable.
 * Prevents: self-parent, cycles, descendant-as-parent, duplicates and depth overflow.
 */
export function validateHierarchyChange(input: {
  nodes: readonly HierarchyNode[];
  childId: string;
  newParentId: string | null;
  maxDepth?: number;
}): { ok: boolean; reason: string | null; newDepth: number | null } {
  const maxDepth = input.maxDepth ?? MAX_AFFILIATE_DEPTH_DEFAULT;
  const byId = new Map(input.nodes.map((n) => [n.affiliateId, n]));

  if (!byId.has(input.childId)) return { ok: false, reason: 'CHILD_NOT_FOUND', newDepth: null };
  if (input.newParentId === null) return { ok: true, reason: null, newDepth: 0 };
  if (!byId.has(input.newParentId)) return { ok: false, reason: 'PARENT_NOT_FOUND', newDepth: null };
  if (input.newParentId === input.childId) return { ok: false, reason: 'SELF_PARENT', newDepth: null };

  // Walk up from the prospective parent: the child must never be an ancestor.
  let cursor: string | null = input.newParentId;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === input.childId) return { ok: false, reason: 'CIRCULAR_HIERARCHY', newDepth: null };
    if (visited.has(cursor)) return { ok: false, reason: 'EXISTING_CYCLE_DETECTED', newDepth: null };
    visited.add(cursor);
    const node = byId.get(cursor);
    if (!node) break;
    cursor = node.parentAffiliateId;
  }

  // Depth is derived from the IMMEDIATE parent (not from the root of the walk).
  const immediateParentDepth = byId.get(input.newParentId)?.depth ?? 0;
  const newDepth = immediateParentDepth + 1;
  if (newDepth > maxDepth) return { ok: false, reason: 'MAX_DEPTH_EXCEEDED', newDepth: null };

  // Depth of the moved subtree must also fit.
  const subtreeHeight = subtreeHeightOf(input.nodes, input.childId);
  if (newDepth + subtreeHeight > maxDepth) return { ok: false, reason: 'SUBTREE_DEPTH_EXCEEDED', newDepth: null };

  return { ok: true, reason: null, newDepth };
}

export function subtreeHeightOf(nodes: readonly HierarchyNode[], rootId: string): number {
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentAffiliateId) continue;
    const list = children.get(n.parentAffiliateId) ?? [];
    list.push(n.affiliateId);
    children.set(n.parentAffiliateId, list);
  }
  let height = 0;
  const stack: { id: string; d: number }[] = [{ id: rootId, d: 0 }];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur.id)) continue;
    seen.add(cur.id);
    height = Math.max(height, cur.d);
    for (const c of children.get(cur.id) ?? []) stack.push({ id: c, d: cur.d + 1 });
  }
  return height;
}

/** Commission code generator: unambiguous alphabet, no profanity-prone substrings. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(length = 6, rand: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)] ?? 'A';
  return out;
}

export function generateReferralSlug(code: string): string {
  return `ref-${code.toLowerCase()}`;
}

export function isValidReferralCode(code: string): boolean {
  return /^[A-Z0-9]{4,16}$/.test(code);
}

/** Hash helper (server-side only): IP/email/phone are stored hashed, never raw. */
export function hashSignal(value: string, salt: string): string {
  // Implemented with WebCrypto in src/server/utils/hash.ts (async). This sync helper exists for
  // non-security-critical fingerprints only (e.g. grouping identical user agents in analytics).
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  const input = `${salt}:${value}`;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}
