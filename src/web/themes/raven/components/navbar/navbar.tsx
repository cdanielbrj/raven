import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { MobileMenu } from "../mobile-menu/mobile-menu";
import {
  navigationItemsFor,
  type NavigationItem,
} from "../../../../routes/navigation";
import "./navbar.css";

export function Navbar({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const context = pathname.startsWith("/sports/football/")
    ? "football"
    : pathname.startsWith("/sports/nba/")
      ? "nba"
      : "anime";
  const navigationItems = navigationItemsFor(context);

  return (
    <div className="raven-layout">
      <header className="raven-navbar">
        <div
          className={`media-context${context !== "anime" ? " media-context-sports" : ""}`}
          aria-label={`Current media type: ${context !== "anime" ? "Sports" : "Anime"}`}
        >
          <span className="media-context-name">RAVEN</span>
          <span className="media-context-type">
            {context !== "anime" ? "Sports" : "Anime"}
          </span>
        </div>
        <nav className="navbar-navigation" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <NavbarItem item={item} key={item.label} />
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
        isOpen={isMobileMenuOpen}
        items={navigationItems}
        onClose={() => setMobileMenuOpen(false)}
      />
    </div>
  );
}

function NavbarItem({ item }: { item: NavigationItem }) {
  if (!item.to) {
    return <span className="navbar-item">{item.label}</span>;
  }

  return (
    <NavLink
      className={({ isActive }) =>
        isActive ? "navbar-item active" : "navbar-item"
      }
      to={item.to}
    >
      {item.label}
    </NavLink>
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
