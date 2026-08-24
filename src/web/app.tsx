import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router";
import { request } from "./api";
import { Navbar } from "./layout/navbar/navbar";
import { DiscoveryView } from "./views/discovery/discovery-view";
import { SettingsView } from "./views/settings/settings-view";
import { TrackingView } from "./views/tracking/tracking-view";
import { UpcomingView } from "./views/upcoming/upcoming-view";
import type { TrackedItem } from "./types";

export function App() {
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
    <Navbar>
      <Routes>
        <Route path="/" element={<Navigate to="/anime/upcoming" replace />} />
        <Route
          path="/:format/upcoming"
          element={
            <AnimeRoute>
              <UpcomingView />
            </AnimeRoute>
          }
        />
        <Route
          path="/:format/discovery"
          element={
            <AnimeRoute>
              <DiscoveryView
                trackedIds={trackedIds}
                onTracked={refreshTracking}
              />
            </AnimeRoute>
          }
        />
        <Route
          path="/:format/tracking"
          element={
            <AnimeRoute>
              <TrackingView onChanged={refreshTracking} />
            </AnimeRoute>
          }
        />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Navigate to="/anime/upcoming" replace />} />
      </Routes>
    </Navbar>
  );
}

function AnimeRoute({ children }: { children: ReactNode }) {
  const { format } = useParams();
  return format === "anime" ? (
    children
  ) : (
    <Navigate to="/anime/upcoming" replace />
  );
}
