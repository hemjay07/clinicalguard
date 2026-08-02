import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, Spinner, ErrorBox } from "../components/ui";

function truncate(s: string, n = 160) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function Cases() {
  const { data, error, loading } = useFetch(() => api.listEvalCases(), []);

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold text-neutral-900">Cases</h1>
      <p className="mt-1 text-neutral-500">Evaluation cases authored so far. Tap a case to view it.</p>

      {loading && <div className="mt-6"><Spinner /></div>}
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}

      {data && (
        <ul className="mt-5 space-y-3">
          {data.map((c) => (
            <li key={c.id}>
              <Link
                to={`/cases/${c.id}`}
                className="cg-card block px-4 py-4 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:px-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-brand-700">
                    {c.condition_names.length ? c.condition_names.join(", ") : (c.case_id ?? `#${c.id}`)}
                  </span>
                  {c.subtype && <span className="text-xs text-neutral-400">{c.subtype}</span>}
                </div>
                <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-800">{truncate(c.query)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-400">
                  {c.authored_by && <span>{c.authored_by}</span>}
                  {c.authored_by && c.submitted_at && <span aria-hidden>·</span>}
                  {c.submitted_at && <span>{new Date(c.submitted_at).toLocaleDateString()}</span>}
                </div>
              </Link>
            </li>
          ))}
          {data.length === 0 && (
            <li className="cg-card px-4 py-10 text-center text-sm text-neutral-500">
              No cases yet. Cases you author will appear here.
            </li>
          )}
        </ul>
      )}
    </PageContainer>
  );
}
