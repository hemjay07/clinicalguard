// Sidebar view showing the whole shape of the case as it stands — filled
// answers and placeholder rows for what's still empty. In the guided flow,
// clicking a row jumps straight to that question's screen.

import type { FormState } from "../caseForm";
import { PHASES, phaseScreens, screenFilled, screenSummary, screenLabel } from "../flow";

export function CasePreview({ form, screenId, onJump }: {
  form: FormState;
  screenId: string | null;          // highlight row for the active guided screen
  onJump: ((id: string) => void) | null; // null = not clickable (full form view)
}) {
  return (
    <div className="h-full overflow-y-auto">
      {PHASES.map((p) => (
        <div key={p.n} className="border-b border-neutral-200">
          <div className="bg-neutral-50 px-4 py-2">
            <span className="cg-eyebrow">Phase {p.n} · {p.title}</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {phaseScreens(p.n).filter((s) => s.kind !== "review").map((s) => {
              const filled = screenFilled(s.kind, form);
              const summary = screenSummary(s.kind, form);
              const active = s.id === screenId;
              const row = (
                <>
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${filled ? "bg-brand-500" : "bg-neutral-200"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-neutral-500">{screenLabel(s.kind)}</span>
                    <span className={`block truncate text-sm ${filled ? "text-neutral-800" : "italic text-neutral-300"}`}>
                      {summary || "Not added"}
                    </span>
                  </span>
                </>
              );
              return onJump ? (
                <button key={s.id} type="button" onClick={() => onJump(s.id)}
                  className={`flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors hover:bg-neutral-50 ${active ? "bg-brand-50/60" : ""}`}>
                  {row}
                </button>
              ) : (
                <div key={s.id} className="flex items-start gap-2.5 px-4 py-2">{row}</div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
