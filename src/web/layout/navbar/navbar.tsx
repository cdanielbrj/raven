import { useState, type ReactNode } from "react";
import { MobileMenu } from "../mobile-menu/mobile-menu";
import type { View } from "../../types";
import "./navbar.css";

const navigationItems = [
  { label: "Overview" },
  { label: "Calendar" },
  { label: "Upcoming", view: "upcoming" },
  { label: "Discovery", view: "discovery" },
  { label: "Tracking", view: "tracking" },
  { label: "Settings" },
] as const;

export function Navbar({
  activeView,
  children,
  onNavigate,
}: {
  activeView: View;
  children: ReactNode;
  onNavigate: (view: View) => void;
}) {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="raven-layout">
      <header className="raven-navbar">
        <div className="media-context" aria-label="Current media type: Anime">
          <span className="media-context-name">RAVEN</span>
          <span className="media-context-type">Anime</span>
        </div>
        <nav className="navbar-navigation" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <NavbarItem
              active={item.view === activeView}
              item={item}
              onNavigate={onNavigate}
              key={item.label}
            />
          ))}
        </nav>
        <div className="topbar-utilities" aria-label="Account utilities">
          <span className="utility-icon" aria-label="Notifications">
            <NavigationIcon name="notifications" />
          </span>
          <span className="utility-avatar" aria-label="User">
            <NavigationIcon name="user" />
          </span>
          <button
            className="mobile-menu-toggle"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label="Open navigation"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="mobile-menu-toggle-lines" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="raven-content">{children}</main>
      <MobileMenu
        activeView={activeView}
        isOpen={isMobileMenuOpen}
        items={navigationItems}
        onClose={() => setMobileMenuOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function NavbarItem({
  active,
  item,
  onNavigate,
}: {
  active: boolean;
  item: (typeof navigationItems)[number];
  onNavigate: (view: View) => void;
}) {
  const className = `navbar-item${active ? " active" : ""}`;

  if (!item.view) {
    return <span className={className}>{item.label}</span>;
  }

  return (
    <button
      className={className}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(item.view)}
    >
      {item.label}
    </button>
  );
}

function NavigationIcon({ name }: { name: "notifications" | "user" }) {
  const paths = {
    notifications: (
      <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    ),
    user: <path d="M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />,
  } as const;

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
