import { useEffect, useRef, useState } from "react";
import { participants } from "./lib/data";
import { currentSession, logout } from "./lib/auth";
import { supabase } from "./lib/supabase";
import type { Participant } from "../../src/types";
import { getRecommendations, getStage, type NextStep } from "./lib/engine";
import { useEnrollments } from "./lib/enrollment";
import EnrollDialog from "./components/EnrollDialog";
import type { Mood } from "./components/Walker";
import Login from "./components/Login";
import AuthCallback from "./components/AuthCallback";
import Header from "./components/Header";
import Hero from "./components/Hero";
import QuoteSection from "./components/QuoteSection";
import JourneySection from "./components/JourneySection";
import NextStepsSection from "./components/NextStepsSection";
import Footer from "./components/Footer";
import ScrollHint from "./components/ScrollHint";
import CommunitySection from "./components/CommunitySection";
import StayConnected from "./components/StayConnected";

export default function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCallback, setIsCallback] = useState(false);

  useEffect(() => {
    // Check if this is the auth callback route (has hash with access_token)
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      setIsCallback(true);
    }

    // Check current session
    async function checkSession() {
      try {
        const session = await currentSession();
        setEmail(session);
      } catch (err) {
        console.error("Failed to check session:", err);
      } finally {
        setLoading(false);
      }
    }

    checkSession();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user?.email) {
          setEmail(session.user.email);
          setIsCallback(false);
        } else {
          setEmail(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (isCallback) {
    return <AuthCallback onReady={() => setIsCallback(false)} />;
  }

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>Loading...</div>;
  }

  const person = email ? participants.find((p) => p.email.toLowerCase() === email.toLowerCase()) : null;

  return (
    <>
      {person ? <Profile person={person} onLogout={() => { logout(); setEmail(null); }} /> : <Login />}
    </>
  );
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
        <CommunitySection person={person} />
        <StayConnected person={person} stage={stage} steps={steps} />
      </main>
      <Footer />
      <ScrollHint />
      {open && (
        <EnrollDialog person={person} step={open} alreadyBooked={enrolled.has(open.name)}
          onConfirm={() => { enroll(open.name); pending.current = { kind: "happy", name: open.name, key: Date.now() }; }}
          onCancel={() => { unenroll(open.name); pending.current = { kind: "sad", name: open.name, key: Date.now() }; }}
          onClose={closeDialog} />
      )}
    </>
  );
}
