/** Public-facing pseudonym only; does not disclose or impersonate staff identity.
 * Stable within one ticket and allowed to vary between distinct conversations.
 */
const names = [
  'Olivia', 'Amelia', 'Sophia', 'Charlotte', 'Mia', 'Emma',
  'Isabella', 'Grace', 'James', 'Daniel', 'Ethan', 'Noah',
  'Oliver', 'Liam', 'Lucas', 'Henry',
] as const;
export function supportOperatorName(ticketId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < ticketId.length; index++) {
    hash = Math.imul(hash ^ ticketId.charCodeAt(index), 16777619);
  }
  return names[(hash >>> 0) % names.length];
}
