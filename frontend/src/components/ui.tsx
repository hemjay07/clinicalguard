// Small shared UI primitives.

import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-500">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  WARNING: "bg-amber-100 text-amber-800 border-amber-200",
  INFO: "bg-sky-100 text-sky-700 border-sky-200",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity?.toUpperCase()] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>
      {severity}
    </span>
  );
}

export function SectionCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
