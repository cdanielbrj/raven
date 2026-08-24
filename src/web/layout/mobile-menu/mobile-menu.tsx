import { useEffect, useState } from "react";
import type { View } from "../../types";
import "./mobile-menu.css";

export interface MobileMenuItem {
  label: string;
  view?: View;
}

export function MobileMenu({
  activeView,
  isOpen,
  items,
  onClose,
  onNavigate,
}: {
  activeView: View;
  isOpen: boolean;
  items: readonly MobileMenuItem[];
  onClose: () => void;
  onNavigate: (view: View) => void;
}) {
  const [isRendered, setIsRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
    } else {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  if (!isRendered) {
    return null;
  }

  return (
    <div
      className={isOpen ? "mobile-menu is-open" : "mobile-menu is-closing"}
      role="dialog"
      aria-modal="true"
    >
      <button
        className="mobile-menu-scrim"
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside
        className="mobile-menu-panel"
        id="mobile-navigation"
        aria-label="Primary navigation"
        onAnimationEnd={() => {
          if (!isOpen) {
            setIsRendered(false);
          }
        }}
      >
        <div className="mobile-menu-heading">
          <button className="mobile-menu-close" onClick={onClose}>
            Close
          </button>
        </div>
        <nav className="mobile-menu-items">
          {items.map((item) => (
            <MobileMenuNavigationItem
              active={item.view === activeView}
              item={item}
              onClose={onClose}
              onNavigate={onNavigate}
              key={item.label}
            />
          ))}
        </nav>
        <div className="mobile-menu-utilities" aria-label="Account utilities">
          <span className="mobile-menu-utility">
            <MobileUtilityIcon name="notifications" />
            Notifications
          </span>
          <span className="mobile-menu-utility">
            <MobileUtilityIcon name="user" />
            User
          </span>
        </div>
      </aside>
    </div>
  );
}

function MobileMenuNavigationItem({
  active,
  item,
  onClose,
  onNavigate,
}: {
  active: boolean;
  item: MobileMenuItem;
  onClose: () => void;
  onNavigate: (view: View) => void;
}) {
  const className = active ? "mobile-menu-item active" : "mobile-menu-item";

  if (!item.view) {
    return <span className={className}>{item.label}</span>;
  }

  return (
    <button
      className={className}
      aria-current={active ? "page" : undefined}
      onClick={() => {
        onNavigate(item.view);
        onClose();
      }}
    >
      {item.label}
    </button>
  );
}

function MobileUtilityIcon({ name }: { name: "notifications" | "user" }) {
  const paths = {
    notifications: (
      <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  } as const;

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
