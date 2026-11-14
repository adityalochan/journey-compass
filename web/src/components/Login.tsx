import { useState, type FormEvent } from "react";
import { participants } from "../lib/data";
import { DEMO_PASSWORD, login } from "../lib/auth";
import RotatingQuote from "./RotatingQuote";

// Hand-authored demo people, one per situation, for quick sign-in during the demo.
const DEMO_IDS = ["p_001", "p_002", "p_004"];

export default function Login({ onLogin }: { onLogin: (id: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const demo = participants.filter((p) => DEMO_IDS.includes(p.id));

  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      onLogin(login(email, password));
    } catch (err) {
      setError((err as Error).message);
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
        <form className="login-form" onSubmit={submit} noValidate>
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to your journey</h1>
          <p className="muted">See where you've been and what could come next.</p>

          <label>
            Email
            <input type="email" autoComplete="email" value={email} required
              onChange={(e) => { setEmail(e.target.value); setError(""); }} />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} required
              onChange={(e) => { setPassword(e.target.value); setError(""); }} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit">Sign in</button>

          <div className="demo-accounts">
            <p>Demo accounts · password <code>{DEMO_PASSWORD}</code></p>
            {demo.map((p) => (
              <button type="button" key={p.id} className="demo-chip"
                onClick={() => { setEmail(p.email); setPassword(DEMO_PASSWORD); setError(""); }}>
                {p.firstName} {p.lastName}
              </button>
            ))}
          </div>
        </form>
      </main>
    </div>
  );
}
