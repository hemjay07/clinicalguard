// Shared UI primitives, built on the design system (see index.css).

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  // The free-tier backend cold-starts in 30-60s after idle. If loading drags
  // past a few seconds, say so — a silent spinner reads as "broken".
  const [slow, setSlow] = useState(false);
  // Drives the wake-up progress bar: flips one frame after `slow` so the CSS
  // width transition animates from its 3% starting point.
  const [fill, setFill] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!slow) return;
    const id = requestAnimationFrame(() => setFill(true));
    return () => cancelAnimationFrame(id);
  }, [slow]);
  return (
    <div className="text-sm text-neutral-500">
      <div className="flex items-center gap-2.5">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-600" />
        <span>{label}</span>
      </div>
      {slow && (
        <>
          <p className="mt-2 text-xs text-neutral-400">
            The server is waking up from sleep — this first load can take up to a minute. Subsequent pages will be fast.
          </p>
          {/* A bounded-feeling wait: eases toward 95% over ~50s (the typical
              cold start) and holds there until the real data lands. */}
          <span className="mt-2.5 block h-1 w-full max-w-xs overflow-hidden rounded-full bg-neutral-200">
            <span
              className="block h-full rounded-full bg-brand-600"
              style={{ width: fill ? "95%" : "3%", transition: "width 50s cubic-bezier(0.2, 0.6, 0.3, 1)" }}
            />
          </span>
        </>
      )}
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
