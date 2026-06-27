// Shared UI primitives, built on the design system (see index.css).

import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-neutral-500">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-600" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

// Muted severity colors (not full-saturation defaults).
const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  WARNING: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  INFO: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity?.toUpperCase()] ?? "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200";
  return <span className={`cg-badge ${style}`}>{severity}</span>;
}

export function SectionCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="cg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="cg-eyebrow">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
