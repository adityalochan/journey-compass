import RotatingQuote from "./RotatingQuote";

export default function QuoteSection() {
  return (
    <section className="quote-band" id="wisdom" aria-label="Wisdom">
      <div className="container">
        <RotatingQuote />
      </div>
    </section>
  );
}
