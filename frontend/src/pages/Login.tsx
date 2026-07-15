// Minimal identity login (ADR-030) — username + passphrase against one of
// the two seeded accounts. No signup, no reset.

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { PageContainer, ErrorBox } from "../components/ui";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/author";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch {
      setError("Invalid username or passphrase.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-serif text-xl font-semibold text-neutral-900">Log in</h1>
        <p className="mt-1 text-sm text-neutral-500">Identifies you as a known author for case attribution.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error && <ErrorBox message={error} />}
          <div>
            <label className="cg-label">Username</label>
            <input
              className="cg-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="cg-label">Passphrase</label>
            <input
              type="password"
              className="cg-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={submitting || !username || !password} className="cg-btn-primary w-full">
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
      </div>
    </PageContainer>
  );
}
