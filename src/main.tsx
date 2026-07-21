import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installErrorInstrumentation } from "./lib/errorInstrumentation";
import { ErrorBoundary } from "./components/ErrorBoundary";

installErrorInstrumentation();

// Apply persisted theme before first paint (default: dark)
(() => {
  const t = (localStorage.getItem("qap.theme") as "light" | "dark" | null) || "dark";
  document.documentElement.classList.toggle("dark", t === "dark");
})();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
