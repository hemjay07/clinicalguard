import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, Spinner, ErrorBox, SectionCard, SeverityBadge } from "../components/ui";

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-400">None recorded.</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

export function ConditionDetail() {
  const { conditionId } = useParams();
  const id = Number(conditionId);
  const { data, error, loading } = useFetch(() => api.conditionDetails(id), [id]);

  return (
    <PageContainer>
      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">{data.name}</h1>
            <Link
              to={`/author/${data.id}`}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Author case for this condition
            </Link>
          </div>
          <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500">
            {data.category && <span className="rounded bg-slate-100 px-2 py-0.5">{data.category}</span>}
            {data.icd10_code && <span className="rounded bg-slate-100 px-2 py-0.5">ICD-10 {data.icd10_code}</span>}
            {data.is_emergency && <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">Emergency</span>}
          </div>

          {data.introduction && (
            <p className="mb-6 max-w-3xl text-sm leading-relaxed text-slate-600">{data.introduction}</p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard title={`Findings (${data.counts.findings})`}>
              <List items={data.findings.map((f) => f.subtype ? `${f.text}  —  ${f.subtype}` : f.text)} />
            </SectionCard>
            <SectionCard title={`Investigations (${data.counts.investigations})`}>
              <List items={data.investigations.map((i) => i.text)} />
            </SectionCard>
            <SectionCard title={`Treatments (${data.counts.treatments})`}>
              <List items={data.treatments.map((t) => t.notes || t.drug_name || t.treatment_type)} />
            </SectionCard>
            <SectionCard title={`Differentials (${data.counts.differentials})`}>
              <List items={data.differentials.map((d) => d.differential_condition)} />
            </SectionCard>
            <SectionCard title={`Complications (${data.counts.complications})`}>
              <List items={data.complications.map((c) => c.complication)} />
            </SectionCard>
            <SectionCard title={`Safety rules (${data.counts.safety_rules})`}>
              {data.safety_rules.length === 0 ? (
                <p className="text-sm text-slate-400">None recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {data.safety_rules.map((r) => (
                    <li key={r.id} className="text-sm">
                      <SeverityBadge severity={r.severity} />{" "}
                      <span className="text-slate-700">{r.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </PageContainer>
  );
}
