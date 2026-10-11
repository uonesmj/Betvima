import crypto from 'node:crypto';

export function verifyNowPaymentsSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const canonical = JSON.stringify(sortObject(parsed));
  const expected = crypto
    .createHmac('sha512', secret)
    .update(canonical)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature.trim(), 'utf8');

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((out, key) => {
      out[key] = sortObject((value as Record<string, unknown>)[key]);
      return out;
    }, {});
}
