import "./tabs.css";
import type { ReactNode } from "react";
import type { View } from "../../types";

export function Tabs({
  activeView,
  onNavigate,
  children,
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
}) {
  return (
    <main className="tabs-layout">
      <header className="tabs-header">
        <button
          className="tabs-wordmark"
          onClick={() => onNavigate("upcoming")}
        >
          RAVEN
        </button>
        <nav className="tabs-navigation" aria-label="Primary navigation">
          <TabButton
            active={activeView === "upcoming"}
            onClick={() => onNavigate("upcoming")}
          >
            Upcoming
          </TabButton>
          <TabButton
            active={activeView === "discovery"}
            onClick={() => onNavigate("discovery")}
          >
            Discovery
          </TabButton>
          <TabButton
            active={activeView === "tracking"}
            onClick={() => onNavigate("tracking")}
          >
            Tracking
          </TabButton>
        </nav>
      </header>
      {children}
    </main>
  );
}

function TabButton({
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
      className={active ? "tab-button active" : "tab-button"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
