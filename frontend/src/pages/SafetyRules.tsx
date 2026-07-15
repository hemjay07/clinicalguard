import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { PageContainer, Spinner, ErrorBox } from "../components/ui";

export function SafetyRules() {
  const { data, error, loading } = useFetch(() => api.safetyRules(), []);
  const [q, setQ] = useState("");
  const [verified, setVerified] = useState("ALL");

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((r) => {
      if (verified === "VERIFIED" && !r.is_verified) return false;
      if (verified === "UNVERIFIED" && r.is_verified) return false;
      const needle = q.trim().toLowerCase();
      if (needle && !r.description.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, q, verified]);

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold text-neutral-900">Safety Rules</h1>
      <p className="mt-1 text-slate-600">
        The deterministic safety engine fires verified rules against AI responses. This is a
        read-only view of all active rules in the database.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search descriptions…"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
        />
        <select value={verified} onChange={(e) => setVerified(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="ALL">All</option>
          <option value="VERIFIED">Verified</option>
          <option value="UNVERIFIED">Unverified</option>
        </select>
      </div>

      {loading && <div className="mt-6"><Spinner /></div>}
      {error && <div className="mt-6"><ErrorBox message={error} /></div>}

      {data && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Condition</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Verified</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                  <td className="px-4 py-2">
                    {r.condition_id ? (
                      <Link to={`/conditions/${r.condition_id}`} className="text-brand-700 hover:underline">
                        {r.condition_name}
                      </Link>
                    ) : (
                      <span className="text-slate-500">{r.condition_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.description}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{r.source}</td>
                  <td className="px-3 py-2">{r.is_active ? "✓" : "—"}</td>
                  <td className="px-3 py-2">{r.is_verified ? "✓" : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">No rules match the filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
