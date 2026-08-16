import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { request } from "./api";
import { DiscoveryPage } from "./pages/discovery-page";
import { TrackingPage } from "./pages/tracking-page";
import { UpcomingPage } from "./pages/upcoming-page";
import "./styles.css";
import type { TrackedItem, View } from "./types";

function App() {
  const [view, setView] = useState<View>("upcoming");
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const refreshTracking = useCallback(async () => {
    const data = await request<{ items: TrackedItem[] }>(
      "/api/v1/tracking?format=anime",
    );
    setTrackedIds(new Set(data.items.map((item) => item.entity.externalId)));
    return data.items;
  }, []);

  useEffect(() => {
    void refreshTracking().catch(() => undefined);
  }, [refreshTracking]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => setView("upcoming")}>
          RAVEN
        </button>
        <nav aria-label="Primary navigation">
          <NavButton
            active={view === "upcoming"}
            onClick={() => setView("upcoming")}
          >
            Upcoming
          </NavButton>
          <NavButton
            active={view === "discovery"}
            onClick={() => setView("discovery")}
          >
            Discovery
          </NavButton>
          <NavButton
            active={view === "tracking"}
            onClick={() => setView("tracking")}
          >
            Tracking
          </NavButton>
        </nav>
      </header>
      {view === "upcoming" && <UpcomingPage />}
      {view === "discovery" && (
        <DiscoveryPage trackedIds={trackedIds} onTracked={refreshTracking} />
      )}
      {view === "tracking" && <TrackingPage onChanged={refreshTracking} />}
    </main>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      className={active ? "nav-button active" : "nav-button"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
