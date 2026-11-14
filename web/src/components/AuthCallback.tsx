import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthCallback({ onReady }: { onReady: () => void }) {
  const [message, setMessage] = useState("Signing you in...");
  const [error, setError] = useState("");

  useEffect(() => {
    async function handleCallback() {
      try {
        // Supabase automatically extracts the token from the URL hash
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
          setMessage("Success! Redirecting...");
          // Give the user a moment to see the success message
          setTimeout(() => onReady(), 500);
        } else {
          setError("No valid session found. The link may have expired.");
        }
      } catch (err) {
        setError((err as Error).message || "Failed to sign in. Please try again.");
      }
    }

    handleCallback();
  }, [onReady]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Journey Compass</h1>
        {error ? (
          <>
            <p style={styles.error}>{error}</p>
            <p style={styles.help}>
              <a href="/">← Back to sign in</a>
            </p>
          </>
        ) : (
          <>
            <p style={styles.message}>{message}</p>
            <div style={styles.spinner} />
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  } as const,
  card: {
    background: "white",
    padding: "2rem",
    borderRadius: "8px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    textAlign: "center",
    maxWidth: "400px",
  } as const,
  title: {
    margin: "0 0 1.5rem 0",
    fontSize: "1.5rem",
    color: "#333",
  } as const,
  message: {
    margin: "1rem 0",
    color: "#666",
    fontSize: "1rem",
  } as const,
  error: {
    margin: "1rem 0",
    color: "#dc3545",
    fontSize: "1rem",
  } as const,
  help: {
    margin: "1rem 0 0 0",
    fontSize: "0.9rem",
  } as const,
  spinner: {
    margin: "2rem auto",
    width: "40px",
    height: "40px",
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #667eea",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  } as const,
};
