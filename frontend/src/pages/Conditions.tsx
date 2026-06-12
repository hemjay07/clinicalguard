import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, Spinner, ErrorBox } from "../components/ui";

export function Conditions() {
  const { data, error, loading } = useFetch(() => api.listConditions(), []);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return needle ? data.filter((c) => c.name.toLowerCase().includes(needle)) : data;
  }, [data, q]);

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-slate-800">NSTG Conditions</h1>
      <p className="mt-1 text-slate-600">
        Browse the {data?.length ?? "…"} conditions ingested from the NSTG and the structured
        data available for each. Click a condition to view its full structured data.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search conditions…"
        className="mt-4 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
      />

      {loading && <div className="mt-6"><Spinner /></div>}
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}

      {data && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Condition</th>
                <th className="px-3 py-2 text-right">Findings</th>
                <th className="px-3 py-2 text-right">Investigations</th>
                <th className="px-3 py-2 text-right">Treatments</th>
                <th className="px-3 py-2 text-right">Differentials</th>
                <th className="px-3 py-2 text-right">Complications</th>
                <th className="px-3 py-2 text-right">Safety rules</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link to={`/conditions/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.counts.findings}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.counts.investigations}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.counts.treatments}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.counts.differentials}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.counts.complications}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.counts.safety_rules}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    No conditions match "{q}".
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
