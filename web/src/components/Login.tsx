import { useState, type FormEvent } from "react";
import { sendMagicLink } from "../lib/auth";
import RotatingQuote from "./RotatingQuote";
import TopControls from "./TopControls";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await sendMagicLink(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message || "Failed to send sign-in link. Please try again.");
      setIsLoading(false);
    }
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
        <form className="login-form" onSubmit={submit} noValidate>
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to your journey</h1>
          <p className="muted">See where you've been and what could come next.</p>

          {sent ? (
            <>
              <div className="success-message">
                <p>✓ Check your email for the sign-in link</p>
                <p className="small-text">Click the link to continue signing in.</p>
              </div>
              <button type="button" onClick={() => { setSent(false); setEmail(""); }}
                className="btn btn-secondary btn-block">
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
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="btn btn-primary btn-block" type="submit" disabled={isLoading}>
                {isLoading ? "Sending..." : "Sign in with email"}
              </button>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
