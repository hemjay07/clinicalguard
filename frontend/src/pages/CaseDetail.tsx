import { useParams, useLocation, Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, Spinner, ErrorBox, SectionCard } from "../components/ui";
import { ARCHETYPES } from "../guidance";

const ARCHETYPE_LABELS: Record<string, string> = Object.fromEntries(ARCHETYPES.map((a) => [a.value, a.label]));

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
  // Set when the author was just redirected here from a successful submit.
  const location = useLocation();
  const submitted = (location.state as { submitted?: boolean; warnings?: string[] } | null) ?? null;

  return (
    <PageContainer>
      {submitted?.submitted && (
        <div className="mb-5 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <p className="font-medium">Case submitted. This is your case as it now exists in the corpus.</p>
          {(submitted.warnings?.length ?? 0) > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-brand-800/80">
              {submitted.warnings!.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}
      {data && (() => {
        const e = data.expected_response ?? {};
        return (
          <>
            <Link to="/cases" className="text-sm text-brand-700 hover:underline">← Cases</Link>
            <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{e.case_id ?? `Case #${data.id}`}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span>Conditions:</span>
              {data.conditions.map((c, i) => (
                <span key={c.id}>
                  <Link to={`/conditions/${c.id}`} className="text-brand-700 hover:underline">{c.name}</Link>
                  {i < data.conditions.length - 1 ? "," : ""}
                </span>
              ))}
              {e.authored_by && <span>· authored by {e.authored_by}</span>}
              <span>· {data.ground_truth_source}</span>
            </div>

            <div className="mt-5 grid gap-4">
              <SectionCard title="Clinical query">
                <p className="text-sm text-slate-700">{data.query}</p>
                {e.what_this_evaluates && (
                  <p className="mt-3 text-sm text-slate-500"><span className="font-medium">What this evaluates: </span>{e.what_this_evaluates}</p>
                )}
                {data.query_scope && (
                  <p className="mt-2 text-sm text-slate-500"><span className="font-medium">Scope: </span>{data.query_scope}</p>
                )}
                {e.provenance_notes && (
                  <p className="mt-2 text-sm text-slate-500"><span className="font-medium">Ground truth provenance: </span>{e.provenance_notes}</p>
                )}
              </SectionCard>

              {((e.reasoning_archetypes?.length ?? 0) > 0 || (e.other_archetypes?.length ?? 0) > 0) && (
                <SectionCard title="Reasoning patterns">
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
                <TierBlock label="Critical differentials" items={e.expected_diagnoses?.required?.critical_differentials} />
                <TierBlock label="Other considerations" items={e.expected_diagnoses?.expected?.other_considerations} />
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
                <TierBlock label="Escalation triggers" items={
                  e.escalation_triggers
                  ?? (e.required_escalation_triggers
                    ? [...(e.required_escalation_triggers.required ?? []), ...(e.required_escalation_triggers.expected ?? [])]
                    : undefined)
                } />
              </SectionCard>

              <SectionCard title="Safety flags">
                <TierBlock label="Selected rules" items={(e.required_safety_flags?.rules ?? []).map((r: any) => `[${r.severity}] ${r.description}`)} />
                <TierBlock label="Free-text flags" items={e.required_safety_flags?.free_text} />
              </SectionCard>
            </div>
          </>
        );
      })()}
    </PageContainer>
  );
}
