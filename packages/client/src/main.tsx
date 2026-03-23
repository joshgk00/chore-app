import '@fontsource-variable/fredoka';
import '@fontsource-variable/inter';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { OnlineProvider } from "./contexts/OnlineContext.js";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <OnlineProvider>
        <App />
      </OnlineProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
