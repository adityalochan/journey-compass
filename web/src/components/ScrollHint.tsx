import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "wisdom", label: "Today's wisdom" },
  { id: "journey", label: "Your journey" },
  { id: "next", label: "Your next steps" },
];

/** Floating pill that points to the next section below the fold; hides at the end of the page. */
export default function ScrollHint() {
  const [target, setTarget] = useState<(typeof SECTIONS)[number] | null>(SECTIONS[0]);

  useEffect(() => {
    const update = () => {
      const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80;
      const next = SECTIONS.find((s) => {
        const el = document.getElementById(s.id);
        return el && el.getBoundingClientRect().top > window.innerHeight * 0.55;
      });
      setTarget(atEnd ? null : next ?? null);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  return (
    <button className={`scroll-hint ${target ? "" : "is-hidden"}`} aria-hidden={!target} tabIndex={target ? 0 : -1}
      onClick={() => target && document.getElementById(target.id)?.scrollIntoView({ behavior: "smooth" })}>
      <span>Scroll to: <strong>{target?.label ?? ""}</strong></span>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}
