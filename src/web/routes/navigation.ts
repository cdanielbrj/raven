export interface NavigationItem {
  label: string;
  to?: string;
}

export const navigationItems: readonly NavigationItem[] = [
  { label: "Overview" },
  { label: "Calendar" },
  { label: "Upcoming", to: "/anime/upcoming" },
  { label: "Discovery", to: "/anime/discovery" },
  { label: "Tracking", to: "/anime/tracking" },
  { label: "Settings", to: "/settings" },
];
