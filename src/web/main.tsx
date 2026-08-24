import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { request } from "./api";
import { Navbar } from "./layout/navbar/navbar";
import { DiscoveryView } from "./views/discovery/discovery-view";
import { TrackingView } from "./views/tracking/tracking-view";
import { UpcomingView } from "./views/upcoming/upcoming-view";
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
    <Navbar activeView={view} onNavigate={setView}>
      {view === "upcoming" && <UpcomingView />}
      {view === "discovery" && (
        <DiscoveryView trackedIds={trackedIds} onTracked={refreshTracking} />
      )}
      {view === "tracking" && <TrackingView onChanged={refreshTracking} />}
    </Navbar>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
