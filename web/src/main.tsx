import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary fallback={<p style={{ padding: 40, fontFamily: "sans-serif" }}>Something went wrong. Please refresh the page.</p>}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
