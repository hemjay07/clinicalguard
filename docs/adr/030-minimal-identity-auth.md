# ADR-030: Minimal identity auth for rating attribution

**Status:** Accepted (2026-07-15)

## Context

Inter-rater work between Mujeeb and Quddus is starting, and it needs to
attribute each case (and later, each rating) to a specific known person. The
tool previously had no real identity: cases were attributed via a free-text
"Authored by" field the author typed themselves, protected by nothing but URL
obscurity. That's not enough once two people are both authoring and rating —
a typed name can be wrong, blank, or (once rating begins) impersonated with
no cost.

Auth was scoped deliberately narrowly: the only requirement is *reliably
identify which known person is using the tool*. This is not a security
project, and building it as one (password reset, roles, self-signup) would be
solving a problem that doesn't exist yet — the set of users is fixed at two
people the maintainers know personally.

## Decision

**Two seeded accounts, session-cookie login, nothing more.**

- A `users` table (`id`, `username`, `password_hash`, `display_name`,
  `created_at`). Exactly two rows for now — Mujeeb and Quddus — created via
  `clinicalguard.auth.seed_user`, a standalone script that hashes a
  passphrase (bcrypt) and upserts by username. No signup endpoint exists;
  seeding is the only way a row is created.
- Login is username + passphrase against `POST /auth/login`, which sets
  `request.session["user_id"]` via Starlette's built-in `SessionMiddleware`
  (a signed cookie, backed by `itsdangerous`) — chosen over JWTs or a
  separate session table because it needs no new infrastructure and Starlette
  already ships it. `GET /auth/me` and `POST /auth/logout` round out the
  three endpoints.
- `get_current_user` (a FastAPI dependency reading the session) gates the two
  write paths only — `POST /eval-cases` and `PUT /eval-cases/{id}`. Every
  read endpoint (browsing conditions, cases, safety rules) stays open, matching
  today's behavior and avoiding scope creep into a permissions system nobody
  asked for.
- `authored_by` is no longer a client-supplied field. `EvalCaseCreate` doesn't
  carry it at all; the case's `expected_response.authored_by` and
  `CandidateSafetyRule.proposed_by` are derived from `current_user.display_name`
  server-side. The frontend shows "Authoring as {name}" (session-derived,
  read-only) instead of a text input — the guided flow's old "who is
  authoring this case?" screen is gone.
- `eval_cases.author_user_id` (nullable FK to `users`) records who owns a
  case, checked by the new `PUT /eval-cases/{id}` endpoint (an author can now
  edit their own submitted case, reusing the full authoring form including
  the safety redesign — ADR-029) before allowing an edit: 403 if the caller
  isn't the owner, including when `author_user_id` is `NULL`. Nullable
  because the 6 cases that existed before this migration have no
  session-backed author — they were backfilled once, matching each case's
  stored free-text `authored_by` string against the two seeded display names,
  not treated as "editable by anyone" by default.
- Cross-origin cookie: the Vercel frontend and Railway backend are different
  origins, so `credentials: "include"` (frontend fetch), `allow_credentials=True`
  (backend CORS, was `False`), and `same_site="none", https_only=True` in
  production are all required together for the session cookie to actually
  arrive. Locally, `cookie_secure=False` keeps `same_site="lax"` over plain
  HTTP, since `SameSite=None` cookies require HTTPS.

## Explicitly not built

Password reset, email verification, roles/permissions, an admin UI, more than
two seeded users, OAuth, or any self-signup path. If external contributors
join later (Phase D), auth gets revisited then — this design does not attempt
to anticipate that.

## Consequences

- Every case created from now on is attributable to a real account, not a
  typed string — the precondition inter-rater work needed.
- Adding a third seeded user is a one-line script invocation, not a schema
  change — but adding *self-service* signup would require real design work
  this ADR deliberately didn't do.
- The one operational cost: rotating a passphrase means re-running the seed
  script, and there's no recovery flow if someone forgets theirs beyond
  asking whoever has shell access to rotate it for them. Acceptable for two
  known people; would not scale past a handful.
