# ADR-031: Real authentication via Supabase Auth (Google OAuth primary)

**Status:** Accepted (2026-08-02). Supersedes ADR-030.

## Context

ADR-030's minimal identity (two seeded username/passphrase accounts) was
scoped to a fixed set of two people the maintainers know personally. That
assumption is ending: physicians the owner does not personally onboard are
about to be invited to author cases and complete the decomposition rating
task. Seeded accounts don't scale past hand-onboarding, a typed passphrase is
friction on a phone, and asserted identity is an integrity hole once results
from strangers matter — "who really authored this" needs a verified answer.

## Decision

**Supabase Auth, with Google OAuth as the primary sign-in.** The project is
already on Supabase (Postgres + pgvector), so this adds no new vendor; Google
sign-in is one tap with no password for an invited physician; and Google
supplies a verified identity. An email magic link is offered as the fallback.
No Auth0/Clerk, no hand-rolled credentials, no self-managed sessions.

- The frontend signs in through supabase-js and sends the Supabase access
  token as a Bearer header. The backend verifies it against the project's
  public JWKS (ES256) — it holds no signing secret and never trusts a
  client-supplied identity.
- The `users` table is re-keyed: `supabase_user_id` (unique) + `email`
  replace `username`/`password_hash`. Integer `users.id` and every
  `eval_cases.author_user_id` FK are preserved.
- On first sign-in a users row is created — or linked by email to an
  existing row, which is how legacy case authorship carries over. The
  owner's row was backfilled with his email in the migration so his link is
  deterministic; other legacy users are linked by setting `email` on their
  row before first sign-in, or by hand-relinking their few cases after.
- **Owner-vs-rater is the only access distinction** (`OWNER_EMAIL` config,
  one equality check — no roles framework). Task results are private:
  authors see only their own cases, raters only their own decomposition
  responses; only the owner reads aggregates. Enforced server-side against
  the verified token.
- Deliberately absent: password reset, email verification flows, admin
  console, invitation system — Google handles identity hygiene, and a URL
  plus sign-in is the whole invitation.

## Consequences

- Sign-in requires the Google provider to be configured once in the Supabase
  dashboard (Google OAuth client ID/secret) — see DEPLOYMENT.md.
- Local seeded passphrases stop working the moment this deploys; both
  existing users sign in with Google instead.
- Tests exercise ownership via dependency overrides; token verification
  itself is covered by live e2e (password-grant test users), not unit tests.
