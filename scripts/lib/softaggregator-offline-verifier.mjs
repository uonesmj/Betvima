/**
 * Pure, read-only verification of a historical SoftAggregator GET callback.
 * Uses the same supplier canonicalization as the protected wallet contract.
 * No network, database, filesystem, logs, or wallet operations.
 * This cannot prove that a historical edge HMAC reached the backend unless
 * the genuine edge header was captured privately; do not fabricate it.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const PATH = '/api/webhooks/softaggregator';
const ALLOWED_HOSTS = new Set([
  'betvima.com',
  'betvima-casino-callback.mimmim283228.workers.dev',
]);
const CLOCK_TOLERANCE_MS = 30_000;

function secureHexMatch(expected, supplied) {
  if (typeof supplied !== 'string' || supplied.length !== expected.length ||
      !/^[a-f0-9]+$/i.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

export function inspectHistoricalSoftAggregatorCallback({
  url, xSignature, edgeSignature = null, salt, edgeSecret = '',
  nowMs = Date.now(),
}) {
  const result = {
    readOnly: true,
    financialOperationsPerformed: false,
    requestShapeValid: false,
    supplierHmacValid: false,
    legacyTimestampMd5Valid: false,
    timestampWithinLiveWindow: false,
    betvimaUserFormatValid: false,
    edgeHmacValid: null,
    realMoneyApproved: false,
  };

  if (typeof url !== 'string' || url.length > 8192 ||
      typeof xSignature !== 'string' ||
      typeof salt !== 'string' || salt.length < 12) return result;

  let parsed;
  try { parsed = new URL(url); } catch { return result; }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname) ||
      parsed.pathname !== PATH || parsed.username || parsed.password ||
      parsed.port || parsed.hash) return result;
  const entries = [...parsed.searchParams.entries()];
  if (entries.length === 0 || entries.length > 24 ||
      new Set(entries.map(([name]) => name)).size !== entries.length ||
      entries.some(([name, value]) => !name || /[&=]/.test(name) || value.includes('&'))) {
    return result;
  }

  const timestamp = parsed.searchParams.get('timestamp') ?? '';
  const legacyKey = parsed.searchParams.get('key') ?? '';
  const epoch = /^\d{10}(?:\d{3})?$/.test(timestamp)
    ? Number(timestamp) * (timestamp.length === 10 ? 1000 : 1) : NaN;
  if (!Number.isSafeInteger(epoch) || !/^[a-f0-9]{32}$/i.test(legacyKey) ||
      !/^[a-f0-9]{64}$/i.test(xSignature.trim())) return result;

  result.requestShapeValid = true;
  const sorted = entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const supplierCanonical = sorted.map(([name, value]) => name + '=' + value).join('&');
  const expectedSupplier = createHmac('sha256', salt).update(supplierCanonical).digest('hex');
  result.supplierHmacValid = secureHexMatch(expectedSupplier, xSignature.trim());

  const expectedMd5 = createHash('md5').update(timestamp + salt).digest('hex');
  result.legacyTimestampMd5Valid = secureHexMatch(expectedMd5, legacyKey);
  result.timestampWithinLiveWindow = Number.isFinite(nowMs) &&
    Math.abs(nowMs - epoch) <= CLOCK_TOLERANCE_MS;
  result.betvimaUserFormatValid = /^bv_[a-f0-9]{32}$/.test(
    parsed.searchParams.get('username') ?? '',
  ) && parsed.searchParams.get('currency') === 'USD' &&
    ['balance', 'debit', 'credit'].includes(parsed.searchParams.get('action'));

  // A historical provider sample does not include the independently generated
  // Cloudflare edge signature. Null explicitly means "not verifiable".
  if (edgeSignature !== null && typeof edgeSignature === 'string' &&
      typeof edgeSecret === 'string' &&
      Buffer.byteLength(edgeSecret, 'utf8') >= 32) {
    const edgeCanonical = new URLSearchParams(sorted).toString();
    const expectedEdge = createHmac('sha256', edgeSecret).update(edgeCanonical).digest('hex');
    result.edgeHmacValid = secureHexMatch(expectedEdge, edgeSignature);
  }
  return result;
}
