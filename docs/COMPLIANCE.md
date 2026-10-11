# Compliance and responsible gaming

The platform ships the controls a licensed sportsbook needs; licensing, KYC vendor selection and
jurisdictional rules remain operator responsibilities and are listed in
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

## Age and identity

* `nova.profiles.age_verified` and `email_verified` are checked before betting; a profile without
  verification is refused server-side.
* KYC status (`not_started`, `pending`, `verified`, `rejected`, `expired`) gates withdrawals per
  operator policy (`/account/kyc`, `/admin/users/[id]` → `set_kyc`). Documents are handled by the KYC
  provider; the platform stores status and references only.

## Responsible gaming

| Control | Where |
| --- | --- |
| Deposit limits (daily/weekly) | `/account/limits`, enforced in `place_bet`/payment paths |
| Stake and loss limits (per bet, daily, weekly) | `nova.user_limits`, `src/domain/risk-engine.ts` |
| Session reminders | `user_limits.session_limit_minutes`, notification worker |
| Cooling-off | `nova.user_restrictions` (`cooling_off`) — blocks betting until the timestamp |
| Self-exclusion | `account_status = 'self_excluded'` + `user_limits.self_excluded_until`; betting, deposits and withdrawals are all refused |
| Reality-check / history | `/account/profile`, `/bets`, `/wallet` statements |
| Operator view | `/admin/users/[id]` shows the limits, restrictions and state changes with reasons |

Lowering a limit takes effect immediately; raising one is an audited admin action. Self-exclusion can
be requested by the customer at any time and cannot be reversed by support without an explicit,
audited override policy.

## Data protection

* Raw IPs are hashed before storage; audit rows keep hashes and correlation ids, not personal data.
* Data minimisation: profiles hold what operations need (email, phone, currency, locale, KYC status).
* Customer-facing endpoints always filter by session user, and RLS provides a second barrier.
* Retention and deletion requests are handled with `account_status = 'closed'`, which preserves
  financial records (a legal requirement) while removing the account from active use; ledger rows are
  never deleted, so an audit trail remains available.

## Anti-money-laundering signals already implemented

Deposit/withdrawal velocity limits, operator approval of every withdrawal, dual approval for large
adjustments, payouts that cannot be marked paid without a real provider reference, affiliate fraud
flags (self-referral, collusion patterns), and a reconciliation job that reports unmatched money
movements instead of hiding them.
