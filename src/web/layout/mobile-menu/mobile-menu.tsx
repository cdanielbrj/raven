import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import type { NavigationItem } from "../../routes/navigation";
import "./mobile-menu.css";

export function MobileMenu({
  isOpen,
  items,
  onClose,
}: {
  isOpen: boolean;
  items: readonly NavigationItem[];
  onClose: () => void;
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
              item={item}
              onClose={onClose}
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
  item,
  onClose,
}: {
  item: NavigationItem;
  onClose: () => void;
}) {
  if (!item.to) {
    return <span className="mobile-menu-item">{item.label}</span>;
  }

  return (
    <NavLink
      className={({ isActive }) =>
        isActive ? "mobile-menu-item active" : "mobile-menu-item"
      }
      onClick={onClose}
      to={item.to}
    >
      {item.label}
    </NavLink>
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
