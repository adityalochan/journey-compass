import { useEffect, useState } from "react";
import { findParticipant, participants } from "./lib/data";
import { getStage } from "./lib/engine";
import Header from "./components/Header";
import Hero from "./components/Hero";
import QuoteSection from "./components/QuoteSection";
import JourneySection from "./components/JourneySection";
import NextStepsSection from "./components/NextStepsSection";
import Footer from "./components/Footer";

// No login in the demo: the participant is chosen with ?id=p_001 or the "Viewing as" picker.
const initialId = new URLSearchParams(window.location.search).get("id");

export default function App() {
  const [id, setId] = useState(findParticipant(initialId).id);
  const person = findParticipant(id);
  const stage = getStage(person);

  useEffect(() => {
    window.history.replaceState(null, "", `?id=${id}`);
    window.scrollTo({ top: 0 });
  }, [id]);

  return (
    <>
      <Header people={participants} selectedId={id} onSelect={setId} />
      <main>
        <Hero person={person} stage={stage} />
        <QuoteSection />
        <JourneySection person={person} />
        <NextStepsSection key={id} person={person} stage={stage} />
      </main>
      <Footer />
    </>
  );
}
