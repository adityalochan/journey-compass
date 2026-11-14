import { useEffect, useState } from "react";
import { QUOTES } from "../lib/quotes";

export default function QuoteSection() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (QUOTES.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % QUOTES.length), 9000);
    return () => clearInterval(t);
  }, []);

  const q = QUOTES[i];
  return (
    <section className="quote-band" id="wisdom" aria-label="Wisdom">
      <div className="container">
        <blockquote>
          <p>“{q.text}”</p>
          <footer>— {q.author}</footer>
        </blockquote>
        {QUOTES.length > 1 && (
          <div className="quote-dots">
            {QUOTES.map((_, n) => (
              <button key={n} aria-label={`Quote ${n + 1}`} aria-current={n === i} onClick={() => setI(n)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
