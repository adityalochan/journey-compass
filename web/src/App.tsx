import { useEffect, useRef, useState } from "react";
import { participants } from "./lib/data";
import { currentSession, logout } from "./lib/auth";
import type { Participant } from "../../src/types";
import { getRecommendations, getStage, type NextStep } from "./lib/engine";
import { useEnrollments } from "./lib/enrollment";
import EnrollDialog from "./components/EnrollDialog";
import type { Mood } from "./components/Walker";
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

  return <Profile person={person} onLogout={() => { logout(); setId(null); }} />;
}

function Profile({ person, onLogout }: { person: Participant; onLogout: () => void }) {
  const stage = getStage(person);
  const steps = getRecommendations(person, stage);
  const { enrolled, enroll, unenroll } = useEnrollments(person.id);
  const [open, setOpen] = useState<NextStep | null>(null);
  // The walker reacts to the last enroll/unenroll once the dialog closes, so the person sees it.
  const [mood, setMood] = useState<Mood | null>(null);
  const pending = useRef<Mood | null>(null);
  const closeDialog = () => {
    if (pending.current) setMood(pending.current);
    pending.current = null;
    setOpen(null);
  };

  return (
    <>
      <Header person={person} onLogout={onLogout} />
      <main>
        <Hero person={person} stage={stage} />
        <QuoteSection />
        <JourneySection person={person} steps={steps} enrolled={enrolled} mood={mood} onOpen={setOpen} />
        <NextStepsSection person={person} stage={stage} steps={steps} enrolled={enrolled} onOpen={setOpen} />
      </main>
      <Footer />
      {open && (
        <EnrollDialog person={person} step={open} alreadyBooked={enrolled.has(open.name)}
          onConfirm={() => { enroll(open.name); pending.current = { kind: "happy", name: open.name, key: Date.now() }; }}
          onCancel={() => { unenroll(open.name); pending.current = { kind: "sad", name: open.name, key: Date.now() }; }}
          onClose={closeDialog} />
      )}
    </>
  );
}
