import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Coordinator from "./components/Coordinator";
import "./styles.css";

const isCoordinator = window.location.pathname.startsWith("/coordinator");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isCoordinator ? <Coordinator /> : <App />}
  </StrictMode>,
);
