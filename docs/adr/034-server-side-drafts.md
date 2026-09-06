# ADR-034: Server-side drafts

**Status:** Accepted
**Date:** 2026-09-06
**Supersedes:** the localStorage draft store introduced in v1.3 and listed in v1.6.

## Context

An author reported starting a case and being unable to get back to it. They
were right, and the reason was structural: a draft lived in `localStorage`,
keyed by the set of conditions it was written against, and nothing in the app
listed drafts. The only routes back were browser history or re-picking exactly
the same conditions to regenerate the key. v1.6 added a list over that store,
which fixed "I can't find it" on the device where the case was written and
nothing more.

The remaining failure modes are the ones that actually lose work. A case begun
on a phone between clinics is not on the laptop that evening. Clearing site
data destroys it. So does a browser in private mode, or a different browser on
the same machine. For a corpus that depends on busy physicians finishing cases
in whatever gaps they have, "your work is on exactly one device" is a bad
promise.

## Decision

The server row is the source of truth. `case_drafts` holds `form_state` as
opaque JSONB — the client's own form shape, stored and handed back unread —
plus the conditions and the internal screen id the author stopped on. The
client mints the draft id, so a draft keeps one identity across debounced saves
and across a reload that lands before the first response.

Nothing validates `form_state`. A draft is half-written by definition; the
eval-case checks still run only at submit. The one rule the server does enforce
is that a pristine form never creates a row, because the client's autosave
fires once on load with an empty form, and without the guard an author who
opened a condition and backed out would accumulate phantom drafts on every
device they ever touched.

`localStorage` is demoted to a crash buffer, keyed by draft id. It holds the
seconds between a keystroke and the debounced PUT that follows, and it is
dropped as soon as the server is level with it. It wins on load only when it is
demonstrably ahead of the server copy, which is what lets an edit made on
another device be authoritative here rather than being silently overwritten by
a stale local copy.

Drafts are private to their author, and another user's draft is 404 rather than
403: whether someone else has a half-written case is not a fact a rater gets to
learn. A successful submit retires the draft it came from.

## Consequences

Drafts now follow the author, which is the whole point. Three things fall out
of it that are worth naming.

Authoring now depends on the network in a place it did not before. The crash
buffer covers a dropped request, and a failed PUT retries on the next edit, but
an author working entirely offline is relying on that buffer rather than on a
durable store. That is a real regression against localStorage for that one
case, and an acceptable one: the previous design's durability was confined to a
single browser anyway.

Loading a draft is asynchronous, and on a cold free-tier backend it can take
most of a minute. Seeding the form when it arrives can therefore land after the
author has started typing. Overwriting them there would destroy exactly the
work this feature exists to protect, so a fetched draft is merged *underneath*
anything already typed, field by field. This was found in end-to-end testing,
not in review.

Drafts written before this change are pushed up once, on first load, and then
cleared locally. If that upload fails it is retried on the next load rather
than dropped, so nothing is lost in the window between deploy and migration.

Rejected: syncing through Supabase directly from the client. It would have
skipped the endpoints, but it puts a second write path into the database that
does not go through the API's ownership checks, and the drafts table would then
be the only table the frontend writes to unmediated.
