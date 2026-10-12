# Betvima / NOVA — maintainer agent instructions

## Execution preference (explicit owner delegation, 2026-10-13)

The project owner prefers an **autonomous GitHub-first workflow**. For repository edits, bug fixes, tests, pull requests and merges, use the connected GitHub tooling directly and finish each logically related batch without requesting the owner to copy terminal commands or repeatedly approve each small step. Investigate an observed error before retrying the same failed operation. Report results, not an endless command-by-command plan.

When authenticated tools support a release or a safe action, carry it through, test it, and verify the actual result. **Never claim production was updated simply because code merged or CI passed.** A push to `main` currently deploys **Preview only**. Production is independently gated by a signed, owner-initiated `workflow_dispatch` with `approve_production=true`; installed, root-owned release-controller scripts are not replaced by Git commits. Do not bypass these protections or weaken signed GitHub OIDC verification. If remote VPS execution or workflow dispatch is not exposed through connected tools, state that concrete limitation rather than inventing success, pretending to have SSH access, or repeatedly telling the owner to run commands.

The site handles **real-money wagers**. Treat wallet transactions, betting authorization, balances, ledger, settlement workers, payouts, SQL migrations and live-odds publication as sensitive. Do not use test bets or live financial mutations to validate web changes. Preserve the running settlement and odds workers; production releases are web-only unless explicitly scoped otherwise. Prefer additive, fail-closed and reversible changes with checked CI, health verification, and an intact database backup barrier. Do not disable backup or alter global database / role settings to work around deployment failures.

## Relevant incident context

- Repository: `uonesmj/Betvima`; production domain: `betvima.com`.
- On 2026-10-12, production run 39 failed at `stage=backup`; the old site stayed healthy. PostgreSQL showed statement timeout while dumping through Supabase **transaction** pooler TCP 6543.
- The dedicated Backup connection was changed to Supabase **session** pooler TCP 5432, preserving web and worker connections to 6543.
- Supavisor 5432 accepted authentication but exposed initial session defaults `2min|off|off`: libpq `PGOPTIONS` startup settings did not take effect there. The reviewed fix in PR #8 runs **connection-local** `SET statement_timeout TO 0` and `SET default_transaction_read_only TO on` and requires `0|on|on` in a read-only transaction. PostgreSQL 17 `pg_dump` independently executes `SET statement_timeout = 0` in its own session. Backup creation, `pg_restore` validation and SHA-256 report remain mandatory.
- Until the root controller on the VPS has actually been updated and a newly approved production workflow completes with verified health, these changes are **repository-only**, not a confirmed live deployment.

These instructions record the project's owner workflow preference in the repository; they do not change ChatGPT account-level Memory settings or grant any tool access that is not actually connected.
