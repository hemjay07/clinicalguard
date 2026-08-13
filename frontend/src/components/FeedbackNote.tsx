// Friction capture (capture-only — no reply path anywhere in the UI).
// NoteLink: the per-screen "leave a note" affordance — an inline line at the
// bottom of each screen card that expands in place (in the document flow, so
// it can never overlap content on mobile). The context prop must say where
// the user was (screen/step + item/field), that's what makes a note
// actionable. ExitFeedback: the one optional end-of-session prompt. Both
// write to the same feedback table. Copy deliberately says "unclear", not
// "confused" — it frames the note as QA feedback on the tool, not an
// admission by the clinician.

import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { FeedbackFlow } from "../types";

type SendState = "idle" | "sending" | "sent" | "error";

function useSend(flow: FeedbackFlow, context: string | null) {
  const [state, setState] = useState<SendState>("idle");
  const send = async (note: string): Promise<boolean> => {
    setState("sending");
    try {
      await api.submitFeedback(flow, context, note);
      setState("sent");
      return true;
    } catch {
      setState("error");
      return false;
    }
  };
  return { state, setState, send };
}

export function NoteLink({ flow, context, label = "Something unclear on this screen?" }: {
  flow: FeedbackFlow;
  context: string | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const { state, setState, send } = useSend(flow, context);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  const submit = async () => {
    if (!note.trim() || state === "sending") return;
    if (await send(note.trim())) {
      // Brief "Thanks, noted", then collapse — the user stays exactly where
      // they were; nothing about their progress is touched.
      setNote("");
      closeTimer.current = window.setTimeout(() => { setOpen(false); setState("idle"); }, 1400);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setState("idle"); }}
        className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600"
      >
        {label} <span className="text-neutral-500 underline underline-offset-2">Leave a note</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
      {state === "sent" ? (
        <p className="py-0.5 text-sm font-medium text-brand-700">Thanks, noted.</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs leading-relaxed text-neutral-500">
              Jot it here and keep going — it helps me fix the tool. No need to wait for a reply.
            </p>
            <button onClick={() => { setOpen(false); setState("idle"); }} aria-label="Close" className="text-neutral-400 hover:text-neutral-600">✕</button>
          </div>
          <div className="mt-2.5 flex gap-2">
            <input
              type="text"
              autoFocus
              className="cg-input flex-1 text-sm"
              placeholder="What's unclear?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            />
            <button onClick={submit} disabled={!note.trim() || state === "sending"} className="cg-btn-primary px-3 py-1.5 text-sm disabled:opacity-50">
              {state === "sending" ? "…" : "Send"}
            </button>
          </div>
          {state === "error" && (
            <p className="mt-1.5 text-xs text-red-600">Couldn't save — try again.</p>
          )}
        </>
      )}
    </div>
  );
}

export function ExitFeedback({ flow, context, onDone }: {
  flow: FeedbackFlow;
  context: string | null;
  onDone?: () => void;
}) {
  const [note, setNote] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const { state, send } = useSend(flow, context);

  if (dismissed) return null;
  if (state === "sent") {
    return (
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-brand-700">
        Thanks, noted.
      </div>
    );
  }

  const skip = () => { setDismissed(true); onDone?.(); };
  const submit = async () => {
    if (!note.trim() || state === "sending") return;
    if (await send(note.trim())) onDone?.();
  };

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
      <p className="text-sm text-neutral-700">Anything confusing or annoying? One line is plenty.</p>
      <div className="mt-2.5 flex gap-2">
        <input
          type="text"
          className="cg-input flex-1 text-sm"
          placeholder="Optional"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        />
        <button onClick={submit} disabled={!note.trim() || state === "sending"} className="cg-btn-primary px-3 py-1.5 text-sm disabled:opacity-50">
          {state === "sending" ? "…" : "Send"}
        </button>
        <button onClick={skip} className="cg-btn-ghost px-3 py-1.5 text-sm">Skip</button>
      </div>
      {state === "error" && <p className="mt-1.5 text-xs text-red-600">Couldn't save — try again.</p>}
    </div>
  );
}
