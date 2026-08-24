import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router";
import { request } from "./api";
import { Navbar } from "./layout/navbar/navbar";
import { DiscoveryView } from "./views/discovery/discovery-view";
import { SettingsView } from "./views/settings/settings-view";
import { TrackingView } from "./views/tracking/tracking-view";
import { TeamsTrackingView } from "./views/teams-tracking/teams-tracking-view";
import { TeamsView } from "./views/teams/teams-view";
import { UpcomingView } from "./views/upcoming/upcoming-view";
import type { TrackedItem } from "./types";

export function App() {
  const [trackedIds, setTrackedIds] = useState<Record<string, Set<string>>>({
    anime: new Set(),
    sport: new Set(),
  });
  const refreshTracking = useCallback(async (format: "anime" | "sport") => {
    const data = await request<{ items: TrackedItem[] }>(
      `/api/v1/tracking?format=${format}`,
    );
    setTrackedIds((current) => ({
      ...current,
      [format]: new Set(data.items.map((item) => item.entity.externalId)),
    }));
    return data.items;
  }, []);

  useEffect(() => {
    void refreshTracking("anime").catch(() => undefined);
    void refreshTracking("sport").catch(() => undefined);
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
                trackedIds={trackedIds.anime}
                onTracked={() => refreshTracking("anime")}
              />
            </AnimeRoute>
          }
        />
        <Route
          path="/:format/tracking"
          element={
            <AnimeRoute>
              <TrackingView onChanged={() => refreshTracking("anime")} />
            </AnimeRoute>
          }
        />
        <Route
          path="/sports/nba/teams"
          element={
            <TeamsView
              trackedIds={trackedIds.sport}
              onTracked={() => refreshTracking("sport")}
            />
          }
        />
        <Route
          path="/sports/nba/tracking"
          element={
            <TeamsTrackingView onChanged={() => refreshTracking("sport")} />
          }
        />
        <Route
          path="/nba/teams"
          element={<Navigate to="/sports/nba/teams" replace />}
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
