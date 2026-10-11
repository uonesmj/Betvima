/** Notification copy (fa/en) for every event the platform emits. */
export type EventLocale = 'en';

interface EventCopy { title: string; body: string }

const COPY: Record<string, Record<EventLocale, (data: Record<string, unknown>) => EventCopy>> = {
  'bet.placed': {
    en: (d) => ({ title: 'Bet placed', body: `Your bet of ${str(d.stake)} at odds ${str(d.odds)} was accepted.` }),
  },
  'bet.won': {
    en: (d) => ({ title: 'Bet won', body: `${str(d.payout)} was credited to your wallet.` }),
  },
  'bet.lost': {
    en: () => ({ title: 'Bet settled', body: 'Your bet was settled as lost. Better luck next time.' }),
  },
  'bet.void': {
    en: (d) => ({ title: 'Bet voided', body: `${str(d.amount)} was refunded to your wallet.` }),
  },
  'bet.partial': {
    en: () => ({ title: 'Partial settlement', body: 'Part of your bet settled; the final result follows once remaining legs finish.' }),
  },
  'bet.cashout': {
    en: (d) => ({ title: 'Cash-out accepted', body: `${str(d.amount)} was credited to your wallet.` }),
  },
  'wallet.deposit': {
    en: (d) => ({ title: 'Deposit credited', body: `${str(d.amount)} was credited to your wallet.` }),
  },
  'wallet.withdrawal': {
    en: (d) => ({ title: 'Withdrawal requested', body: `Your withdrawal of ${str(d.amount)} was submitted.` }),
  },
  'wallet.adjustment': {
    en: (d) => ({ title: 'Wallet adjustment', body: `An adjustment of ${str(d.amount)} was applied by support.` }),
  },
  'account.verified': {
    en: () => ({ title: 'Account verified', body: 'Your identity verification is complete.' }),
  },
  'account.restricted': {
    en: (d) => ({ title: 'Account restricted', body: `Your account was restricted: ${str(d.reason)}` }),
  },
  'account.self_excluded': {
    en: (d) => ({ title: 'Self-exclusion active', body: `Your account is inactive until ${str(d.until)}.` }),
  },
  'affiliate.approved': {
    en: () => ({ title: 'Affiliate approved', body: 'Your affiliate account is active.' }),
  },
  'affiliate.commission': {
    en: (d) => ({ title: 'New commission', body: `Commission of ${str(d.amount)} was calculated for ${str(d.period)}.` }),
  },
  'affiliate.payout_requested': {
    en: (d) => ({ title: 'Payout requested', body: `Your payout request of ${str(d.amount)} was submitted.` }),
  },
  'affiliate.payout_paid': {
    en: (d) => ({ title: 'Payout paid', body: `${str(d.amount)} was paid.` }),
  },
  'security.new_device': {
    en: () => ({ title: 'New device sign-in', body: 'If this was not you, change your password immediately.' }),
  },
  'security.login': {
    en: () => ({ title: 'Signed in', body: 'A new sign-in to your account was recorded.' }),
  },
  'system.maintenance': {
    en: (d) => ({ title: 'Maintenance mode', body: `${str(d.message)}` }),
  },
};

const str = (value: unknown): string => (value === null || value === undefined ? '-' : String(value));

export function messageFor(eventKey: string, locale: EventLocale, data: Record<string, unknown>): EventCopy {
  const entry = COPY[eventKey];
  if (!entry) return { title: eventKey, body: '' };
  return entry[locale](data);
}

export const KNOWN_EVENT_KEYS = Object.keys(COPY);
