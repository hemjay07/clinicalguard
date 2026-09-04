import { useMemo, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { useAuth } from "../AuthContext";
import { PageContainer, Spinner, ErrorBox, SectionCard } from "../components/ui";
import { ExitFeedback } from "../components/FeedbackNote";
import { ARCHETYPES, PROVENANCE_TIERS } from "../guidance";
import { LABELS } from "../labels";
import { fromExpectedResponse } from "../caseForm";
import { emptyOptional } from "../flow";

// The case page is the one author-facing surface where the framework's own
// short names for the reasoning patterns still earn their place: as chips on
// a finished artifact they read as tags, not as a taxonomy the author has to
// learn mid-question.
const ARCHETYPE_LABELS: Record<string, string> = Object.fromEntries(ARCHETYPES.map((a) => [a.value, a.label]));
const PROVENANCE_LABELS: Record<string, string> = Object.fromEntries(PROVENANCE_TIERS.map((t) => [t.value, t.label]));

// NSTG condition names arrive lower-cased for some entries ("abortion"). The
// author wrote a case about Abortion, so that is what the page says.
const displayName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

function TierBlock({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="text-xs font-medium tracking-wide text-neutral-400">{label}</div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

function SituationalBlock({ items, valueKey }: { items?: { trigger: string; [k: string]: string }[]; valueKey: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="text-xs font-medium tracking-wide text-neutral-400">Situational</div>
      <ul className="space-y-1 pl-5 text-sm text-slate-700">
        {items.map((s, i) => (
          <li key={i} className="list-disc">
            {s[valueKey]} <span className="text-slate-400">— trigger: {s.trigger}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CaseDetail() {
  const { caseId } = useParams();
  const id = Number(caseId);
  const { data, error, loading } = useFetch(() => api.evalCase(id), [id]);
  const { user, refresh } = useAuth();
  // Set when the author was just redirected here from a successful submit
  // or edit.
  const location = useLocation();
  const nav = (location.state as { submitted?: boolean; updated?: boolean; warnings?: string[] } | null) ?? null;
  // Contribute-more opt-in state for the success screen. "done" also covers
  // authors who opted in on an earlier case — no re-asking.
  const [interest, setInterest] = useState<"idle" | "saving" | "done">("idle");
  const optedIn = interest === "done" || !!user?.contribute_opt_in;
  // Counted the same way the review screen counts them, from the same form
  // model, so the number on the thank-you card matches what the author just
  // saw before submitting.
  const emptyCount = useMemo(
    () => (data ? emptyOptional(fromExpectedResponse(data)).length : 0),
    [data],
  );

  async function expressInterest() {
    if (interest === "saving") return;
    setInterest("saving");
    try {
      await api.contributeInterest();
      setInterest("done");
      refresh();
    } catch {
      setInterest("idle");
    }
  }

  return (
    <PageContainer>
      {/* Post-submission success screen (new cases). Deliberately restrained:
          thank-you, attribution, edit pointer, the contribute-more prompt,
          author-another — and nothing else. */}
      {nav?.submitted && (
        <div className="cg-screen-enter cg-card mb-6 px-6 py-7 sm:px-8">
          <h2 className="font-serif text-2xl font-semibold text-neutral-900">
            Thank you. Your case is submitted.
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-neutral-600">
            You'll be credited in the research paper.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">
            You can edit it any time from your <Link to="/cases" className="text-brand-700 underline underline-offset-2 hover:no-underline">Cases</Link> page.
          </p>
          {/* What was an amber warning box is one grey line. Nothing here is
              wrong with the case — the optional sections are optional, and
              the moment the author finishes is the worst possible time to
              tell them their work looks incomplete. */}
          {emptyCount > 0 && (
            <p className="mt-2 text-sm text-neutral-400">
              {emptyCount} optional section{emptyCount === 1 ? " is" : "s are"} still empty. Add {emptyCount === 1 ? "it" : "them"} any time from Cases.
            </p>
          )}

          {/* The one that matters: capture willingness at the moment of
              completion. Visually distinct so it doesn't sink under the
              thank-you. Capture-only — the owner follows up manually. */}
          <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3.5">
            {optedIn ? (
              <p className="text-sm font-medium text-brand-800">
                Noted — thank you. That genuinely helps this research.
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-brand-900">
                  Interested in contributing more? There are other short ways to help shape this research.
                </p>
                <button
                  onClick={expressInterest}
                  disabled={interest === "saving"}
                  className="cg-btn-primary shrink-0 px-4 py-1.5 text-sm disabled:opacity-50"
                >
                  {interest === "saving" ? "…" : "I'm interested"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-5">
            <Link to="/author" className="text-sm font-medium text-brand-700 hover:underline">
              Author another case →
            </Link>
          </div>
        </div>
      )}

      {nav?.updated && (
        <div className="mb-5 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <p className="font-medium">Case updated. This is your case as it now exists in the corpus.</p>
          {(nav.warnings?.length ?? 0) > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-brand-800/80">
              {nav.warnings!.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {/* End-of-session friction capture — optional, skippable. */}
          <div className="text-neutral-700">
            <ExitFeedback flow="authoring" context={`exit: after updating case ${id}`} />
          </div>
        </div>
      )}
      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}
      {data && (() => {
        const e = data.expected_response ?? {};
        return (
          <>
            <div className="flex items-center justify-between gap-3">
              <Link to="/cases" className="-mx-2 rounded-lg px-2 py-2 text-sm text-brand-700 hover:underline">← Cases</Link>
              {user && data.author_user_id === user.id && (
                <Link to={`/cases/${data.id}/edit`} className="cg-btn-secondary px-4 py-2 text-sm">Edit case</Link>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
              {data.conditions.length
                ? data.conditions.map((c) => displayName(c.name)).join(", ")
                : `Case #${data.id}`}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span>Conditions:</span>
              {data.conditions.map((c, i) => (
                <span key={c.id}>
                  <Link to={`/conditions/${c.id}`} className="text-brand-700 hover:underline">{c.name}</Link>
                  {i < data.conditions.length - 1 ? "," : ""}
                </span>
              ))}
              {e.authored_by && <span>· authored by {e.authored_by}</span>}
              <span>· authored in the app</span>
              {data.updated_at && <span>· edited {new Date(data.updated_at).toLocaleDateString()}</span>}
            </div>

            <div className="mt-5 grid gap-4">
              <SectionCard title={LABELS.query}>
                <p className="text-sm text-slate-700">{data.query}</p>
                {e.what_this_evaluates && (
                  <p className="mt-3 text-sm text-slate-500"><span className="font-medium">{LABELS.evaluates}: </span>{e.what_this_evaluates}</p>
                )}
                {data.query_scope && (
                  <p className="mt-2 text-sm text-slate-500"><span className="font-medium">{LABELS.scope}: </span>{data.query_scope}</p>
                )}
                {(data.guideline_provenance || e.provenance_notes) && (
                  <p className="mt-2 text-sm text-slate-500">
                    <span className="font-medium">{LABELS.provenance}: </span>
                    {data.guideline_provenance && (PROVENANCE_LABELS[data.guideline_provenance] ?? data.guideline_provenance)}
                    {data.guideline_provenance && e.provenance_notes ? " — " : ""}
                    {e.provenance_notes}
                  </p>
                )}
              </SectionCard>

              {((e.reasoning_archetypes?.length ?? 0) > 0 || (e.other_archetypes?.length ?? 0) > 0) && (
                <SectionCard title={LABELS.archetypes}>
                  <div className="flex flex-wrap gap-2">
                    {(e.reasoning_archetypes ?? []).map((v: string) => (
                      <span key={v} className="rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700">
                        {ARCHETYPE_LABELS[v] ?? v}
                      </span>
                    ))}
                    {(e.other_archetypes ?? []).map((v: string, i: number) => (
                      <span key={`o${i}`} className="rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700">
                        {v}
                      </span>
                    ))}
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Expected diagnoses">
                <TierBlock label="Primary" items={e.expected_diagnoses?.required?.primary ? [e.expected_diagnoses.required.primary] : []} />
                <TierBlock label={LABELS.critical_differentials} items={e.expected_diagnoses?.required?.critical_differentials} />
                <TierBlock label={LABELS.other_considerations} items={e.expected_diagnoses?.expected?.other_considerations} />
              </SectionCard>

              <SectionCard title="Investigations">
                <TierBlock label="Required" items={e.required_investigations?.required} />
                <TierBlock label="Expected" items={e.required_investigations?.expected} />
                <SituationalBlock items={e.required_investigations?.situational} valueKey="test" />
              </SectionCard>

              <SectionCard title="Treatments">
                <TierBlock label="Required" items={e.required_treatments?.required} />
                <TierBlock label="Expected" items={e.required_treatments?.expected} />
                <SituationalBlock items={e.required_treatments?.situational} valueKey="treatment" />
              </SectionCard>

              <SectionCard title="Differentials & complications">
                <TierBlock label="Complications" items={e.complications} />
              </SectionCard>

              <SectionCard title="Monitoring & escalation">
                {e.required_monitoring?.required_principle && (
                  <p className="mb-2 text-sm italic text-slate-600">{e.required_monitoring.required_principle}</p>
                )}
                <TierBlock label="Monitoring — required" items={e.required_monitoring?.required_elements} />
                <TierBlock label="Monitoring — expected" items={e.required_monitoring?.expected_elements} />
                {/* Escalation is flat (ADR-028); legacy blobs may still carry the old tiered shape. */}
                <TierBlock label={LABELS.escalation} items={
                  e.escalation_triggers
                  ?? (e.required_escalation_triggers
                    ? [...(e.required_escalation_triggers.required ?? []), ...(e.required_escalation_triggers.expected ?? [])]
                    : undefined)
                } />
              </SectionCard>

              <SectionCard title={LABELS.safety_harm}>
                {e.required_safety_flags?.none_declared ? (
                  <p className="text-sm italic text-slate-500">Nothing rises to that level for this patient.</p>
                ) : (
                  <TierBlock label={LABELS.safety_harm} items={e.required_safety_flags?.free_text} />
                )}
                <TierBlock label="Safety rules from the guideline" items={(e.required_safety_flags?.rules ?? []).map((r: any) => r.description)} />
              </SectionCard>
            </div>
          </>
        );
      })()}
    </PageContainer>
  );
}
