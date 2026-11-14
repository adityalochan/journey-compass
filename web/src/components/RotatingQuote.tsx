import { useCallback, useEffect, useRef, useState } from "react";
import { QUOTES } from "../lib/quotes";

const INTERVAL_MS = 20_000;
const FADE_MS = 900; // keep in sync with .rq-text transition in styles.css

/** Cross-fading quote carousel. Pauses on hover/focus; respects reduced motion via CSS. */
export default function RotatingQuote({ className = "" }: { className?: string }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const swapping = useRef<number>();

  const go = useCallback((step: number) => {
    window.clearTimeout(swapping.current);
    setVisible(false);
    swapping.current = window.setTimeout(() => {
      setI((n) => (n + step + QUOTES.length) % QUOTES.length);
      setVisible(true);
    }, FADE_MS);
  }, []);

  useEffect(() => {
    if (paused || QUOTES.length < 2) return;
    const t = window.setTimeout(() => go(1), INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [i, paused, go]);

  useEffect(() => () => window.clearTimeout(swapping.current), []);

  const q = QUOTES[i];
  return (
    <figure className={`rq ${className}`}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className={`rq-text ${visible ? "is-in" : "is-out"} ${q.text.length > 180 ? "rq-long" : ""}`} aria-live="polite">
        <blockquote><p>“{q.text}”</p></blockquote>
        <figcaption>— {q.author}</figcaption>
      </div>
    </figure>
  );
}
