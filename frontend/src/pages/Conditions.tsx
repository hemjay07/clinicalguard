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
      <h1 className="text-2xl font-semibold text-neutral-900">NSTG Conditions</h1>
      <p className="mt-1 text-slate-600">
        Browse the {data?.length ?? "…"} conditions ingested from the NSTG and the structured
        data available for each. Click a condition to view its full structured data.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search conditions…"
        className="cg-input mt-4 max-w-md"
      />

      {loading && <div className="mt-6"><Spinner /></div>}
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}

      {data && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Condition</th>
                {/* Counts are secondary detail — desktop only; mobile gets a clean tappable list. */}
                <th className="hidden px-3 py-2.5 text-right md:table-cell">Findings</th>
                <th className="hidden px-3 py-2.5 text-right md:table-cell">Investigations</th>
                <th className="hidden px-3 py-2.5 text-right md:table-cell">Treatments</th>
                <th className="hidden px-3 py-2.5 text-right md:table-cell">Differentials</th>
                <th className="hidden px-3 py-2.5 text-right md:table-cell">Complications</th>
                <th className="hidden px-3 py-2.5 text-right md:table-cell">Safety rules</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link to={`/conditions/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">{c.counts.findings}</td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">{c.counts.investigations}</td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">{c.counts.treatments}</td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">{c.counts.differentials}</td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">{c.counts.complications}</td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">{c.counts.safety_rules}</td>
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
