// Opt-in guidance. A small "?" button that opens a panel with verbatim guidance
// text. Guidance is never shown by default — the MD must choose to read it, so
// the framework does not shape how cases are authored.

import { useState } from "react";

export function GuidanceIcon({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Guidance: ${title}`}
        onClick={() => setOpen(true)}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500 hover:bg-slate-100"
      >
        ?
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close guidance"
              >
                ✕
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
              {text}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
