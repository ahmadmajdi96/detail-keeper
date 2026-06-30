import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installErrorInstrumentation } from "./lib/errorInstrumentation";
import { ErrorBoundary } from "./components/ErrorBoundary";

installErrorInstrumentation();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
