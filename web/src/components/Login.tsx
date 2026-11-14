import { useState, type FormEvent } from "react";
import { DEMO_PASSWORD, sendMagicLink, signInWithPassword } from "../lib/auth";
import RotatingQuote from "./RotatingQuote";
import TopControls from "./TopControls";

const DEMO_ACCOUNTS = [
  { label: "Priya Raman", email: "priya.demo@example.org" },
  { label: "Marc Lefèvre", email: "marc.demo@example.org" },
  { label: "Daniel Osei", email: "daniel.demo@example.org" },
  { label: "Coordinator", email: "coordinator.demo@example.org" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    run(() => signInWithPassword(email, password));
  }

  function emailLink() {
    if (!email.trim()) return setError("Enter your email first.");
    run(async () => { await sendMagicLink(email); setSent(true); });
  }

  return (
    <div className="login">
      <aside className="login-art">
        <a className="wordmark wordmark-light" href="#">Journey Compass</a>
        <RotatingQuote className="rq-light" />
        <p className="login-art-note">Your practice, your path, one step at a time.</p>
      </aside>

      <main className="login-main">
        <div className="login-controls"><TopControls /></div>
        <form className="login-form" onSubmit={submitPassword} noValidate>
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to your journey</h1>
          <p className="muted">See where you've been and what could come next.</p>

          {sent ? (
            <>
              <div className="success-message">
                <p>Check your email for the sign-in link</p>
                <p className="small-text">Open it on this device to continue.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setSent(false)}>
                Back
              </button>
            </>
          ) : (
            <>
              <label>
                Email
                <input type="email" autoComplete="email" value={email} required
                  onChange={(e) => { setEmail(e.target.value); setError(""); }} />
              </label>
              <label>
                Password
                <input type="password" autoComplete="current-password" value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }} />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={emailLink} disabled={busy}>
                Email me a sign-in link instead
              </button>

              <div className="demo-accounts">
                <p>Demo accounts · password <code>{DEMO_PASSWORD}</code></p>
                {DEMO_ACCOUNTS.map((a) => (
                  <button type="button" key={a.email} className="demo-chip"
                    onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setError(""); }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
