import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { OnlineProvider } from "./contexts/OnlineContext.js";
import { useSyncOnReconnect } from "./lib/draft-sync.js";
import "./styles/globals.css";

function SyncOnReconnect({ children }: { children: React.ReactNode }) {
  useSyncOnReconnect();
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <OnlineProvider>
        <SyncOnReconnect>
          <App />
        </SyncOnReconnect>
      </OnlineProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
