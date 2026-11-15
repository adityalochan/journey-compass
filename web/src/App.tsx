import { useEffect, useRef, useState } from "react";
import { currentSession, logout } from "./lib/auth";
import { supabase } from "./lib/supabase";
import type { Participant, Stage } from "../../src/types";
import type { NextStep } from "./lib/steps";
import { loadMyJourney, type MyJourney } from "./lib/db";
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

  if (!email) return <Login />;
  return <SignedIn email={email} onLogout={() => { logout(); setEmail(null); }} />;
}

/** Loads the signed-in person's own journey from Supabase, then shows their profile. */
function SignedIn({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [state, setState] = useState<{ data?: MyJourney; error?: string }>({});

  useEffect(() => {
    let live = true;
    setState({});
    loadMyJourney()
      .then((data) => live && setState({ data }))
      .catch((e: Error) => live && setState({ error: e.message }));
    return () => { live = false; };
  }, [email]);

  if (!state.data && !state.error) {
    return <div className="page-message"><p>Loading your journey…</p></div>;
  }
  if (state.error || !state.data?.me) {
    return (
      <div className="page-message">
        <h2>We couldn't find your journey</h2>
        <p className="muted">{state.error ? `Something went wrong: ${state.error}` : `You're signed in as ${email}, but there's no participant journey for this account.`}</p>
        <button className="btn btn-primary" onClick={onLogout}>Sign out</button>
      </div>
    );
  }
  const { me, stage, steps } = state.data;
  return <Profile person={me} stage={stage} steps={steps} onLogout={onLogout} />;
}

function Profile({ person, stage, steps, onLogout }: { person: Participant; stage: Stage; steps: NextStep[]; onLogout: () => void }) {
  const { enrolled, enroll, unenroll } = useEnrollments(person.id, steps);
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
