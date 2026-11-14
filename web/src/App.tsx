import { useEffect, useState } from "react";
import { participants } from "./lib/data";
import { currentSession, logout } from "./lib/auth";
import { getStage } from "./lib/engine";
import Login from "./components/Login";
import Header from "./components/Header";
import Hero from "./components/Hero";
import QuoteSection from "./components/QuoteSection";
import JourneySection from "./components/JourneySection";
import NextStepsSection from "./components/NextStepsSection";
import Footer from "./components/Footer";

export default function App() {
  const [id, setId] = useState<string | null>(currentSession());
  const person = participants.find((p) => p.id === id);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [id]);

  if (!person) return <Login onLogin={setId} />;

  const stage = getStage(person);
  return (
    <>
      <Header person={person} onLogout={() => { logout(); setId(null); }} />
      <main>
        <Hero person={person} stage={stage} />
        <QuoteSection />
        <JourneySection person={person} />
        <NextStepsSection key={person.id} person={person} stage={stage} />
      </main>
      <Footer />
    </>
  );
}
