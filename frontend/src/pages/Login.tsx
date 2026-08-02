// One sign-in surface (ADR-031): "Continue with Google" is the primary,
// obvious action — one tap, no account creation, verified identity. Email
// magic link is the fallback for anyone without a Google account.

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { supabase } from "../supabase";
import { PageContainer, ErrorBox } from "../components/ui";

export function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/author";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  // Already signed in (or just completed the OAuth redirect) — go to the task.
  useEffect(() => {
    if (!loading && user) navigate(from, { replace: true });
  }, [loading, user, from, navigate]);

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${from}` },
    });
    if (error) {
      setError("Google sign-in failed to start. Please try again.");
      setBusy(false);
    }
    // On success the browser navigates away to Google.
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${from}` },
    });
    setBusy(false);
    if (error) setError("Couldn't send the sign-in link. Check the address and try again.");
    else setLinkSent(true);
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-serif text-xl font-semibold text-neutral-900">Sign in</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Identifies you as the author of what you submit. One tap — no account to create.
        </p>

        <div className="mt-6 space-y-4">
          {error && <ErrorBox message={error} />}

          <button
            onClick={signInWithGoogle}
            disabled={busy}
            className="cg-btn-primary flex w-full items-center justify-center gap-2.5 py-2.5"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-neutral-400">
            <span className="h-px flex-1 bg-neutral-200" />
            or
            <span className="h-px flex-1 bg-neutral-200" />
          </div>

          {linkSent ? (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Check your email — we sent a sign-in link to <strong>{email.trim()}</strong>.
            </p>
          ) : (
            <form onSubmit={sendMagicLink} className="space-y-3">
              <div>
                <label className="cg-label">Email</label>
                <input
                  type="email"
                  className="cg-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="cg-btn-secondary w-full"
              >
                Email me a sign-in link
              </button>
            </form>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
