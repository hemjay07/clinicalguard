// Opt-in guidance. A small "?" button that opens a panel with verbatim guidance
// text. Guidance is never shown by default — the MD must choose to read it, so
// the framework does not shape how cases are authored.

import { useState } from "react";

// Minimal inline markdown: **bold** and `code`. (No nesting needed for our text.)
function renderInline(s: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${keyPrefix}-b${i}`} className="font-semibold text-neutral-900">{tok.slice(2, -2)}</strong>);
    else out.push(<code key={`${keyPrefix}-c${i}`} className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[13px]">{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
    i++;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

// Render a guidance body: blank-line-separated blocks; "- " lines become a list.
function renderGuidance(text: string): React.ReactNode {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length) {
      const items = bullets;
      blocks.push(
        <ul key={`ul${key++}`} className="my-2 list-disc space-y-1 pl-5">
          {items.map((b, j) => <li key={j}>{renderInline(b, `ul${key}-${j}`)}</li>)}
        </ul>
      );
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
      continue;
    }
    flushBullets();
    if (line) blocks.push(<p key={`p${key++}`} className="my-2">{renderInline(line, `p${key}`)}</p>);
  }
  flushBullets();
  return <div className="text-sm leading-relaxed text-neutral-700">{blocks}</div>;
}

export function GuidanceIcon({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Guidance: ${title}`}
        onClick={() => setOpen(true)}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 text-xs font-semibold text-neutral-500 hover:bg-neutral-100"
      >
        ?
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 normal-case tracking-normal"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between">
              <h3 className="font-serif text-lg font-semibold text-neutral-900">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100"
                aria-label="Close guidance"
              >
                ✕
              </button>
            </div>
            {renderGuidance(text)}
          </div>
        </div>
      )}
    </>
  );
}
