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

export function navigationItemsFor(
  context: "anime" | "nba",
): readonly NavigationItem[] {
  if (context === "anime") return navigationItems;

  return [
    { label: "Overview" },
    { label: "Calendar" },
    { label: "Upcoming", to: "/sports/nba/upcoming" },
    { label: "Teams", to: "/sports/nba/teams" },
    { label: "Tracking", to: "/sports/nba/tracking" },
    { label: "Settings", to: "/settings" },
  ];
}
