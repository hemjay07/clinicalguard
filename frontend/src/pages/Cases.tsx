import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, Spinner, ErrorBox } from "../components/ui";

function truncate(s: string, n = 80) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function Cases() {
  const { data, error, loading } = useFetch(() => api.listEvalCases(), []);

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-slate-800">Submitted Cases</h1>
      <p className="mt-1 text-slate-600">Evaluation cases authored so far. Click a case to view it.</p>

      {loading && <div className="mt-6"><Spinner /></div>}
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}

      {data && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Case</th>
                <th className="px-3 py-2">Condition</th>
                <th className="px-3 py-2">Subtype</th>
                <th className="px-3 py-2">Query</th>
                <th className="px-3 py-2">Author</th>
                <th className="px-3 py-2">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link to={`/cases/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.case_id ?? `#${c.id}`}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{c.condition_names.length ? truncate(c.condition_names.join(", "), 40) : "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{c.subtype ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{truncate(c.query)}</td>
                  <td className="px-3 py-2 text-slate-600">{c.authored_by ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {c.submitted_at ? new Date(c.submitted_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No cases authored through the UI yet. This list will populate as Mujeeb and
                    Abdulquddus submit cases through the authoring interface.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
