import { useState, type FormEvent } from "react";
import { sendMagicLink, signInWithPassword } from "../lib/auth";
import RotatingQuote from "./RotatingQuote";
import TopControls from "./TopControls";

export default function Login() {
  // The same sign-in screen serves participants (/) and coordinators (/coordinator).
  const isCoordinator = window.location.pathname.startsWith("/coordinator");
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
          {isCoordinator ? (
            <>
              <p className="eyebrow">Staff only <span className="role-badge">Coordinator</span></p>
              <h1>Coordinator sign in</h1>
              <p className="muted">See your people, their requests, and the AI-drafted outreach.</p>
            </>
          ) : (
            <>
              <p className="eyebrow">Welcome back</p>
              <h1>Sign in to your journey</h1>
              <p className="muted">See where you've been and what could come next.</p>
            </>
          )}

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
                  placeholder={isCoordinator ? "Coordinator email" : "Your email"}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }} />
              </label>
              <label>
                Password
                <input type="password" autoComplete="current-password" value={password}
                  placeholder={isCoordinator ? "Coordinator password" : "Your password"}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }} />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={emailLink} disabled={busy}>
                Email me a sign-in link instead
              </button>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
