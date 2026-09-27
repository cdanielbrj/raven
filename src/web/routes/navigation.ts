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
  context: "anime" | "nba" | "football",
): readonly NavigationItem[] {
  if (context === "anime") return navigationItems;

  if (context === "football") {
    return [
      { label: "Overview" },
      { label: "Calendar" },
      { label: "Countries", to: "/sports/football/countries" },
      { label: "Teams", to: "/sports/football/teams" },
      { label: "Tracking", to: "/sports/football/tracking" },
      { label: "Settings", to: "/settings" },
    ];
  }

  return [
    { label: "Overview" },
    { label: "Calendar" },
    { label: "Upcoming", to: "/sports/nba/upcoming" },
    { label: "Teams", to: "/sports/nba/teams" },
    { label: "Tracking", to: "/sports/nba/tracking" },
    { label: "Settings", to: "/settings" },
  ];
}
