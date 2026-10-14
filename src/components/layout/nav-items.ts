export interface NavItem {
  href: string;
  label: string;
  description?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/events", label: "Events", description: "Every event, every series, filterable" },
  { href: "/standings", label: "Standings", description: "Angler of the Year and points races" },
  { href: "/anglers", label: "Anglers", description: "Profiles from high school to the top tour" },
  { href: "/organizations", label: "Organizations", description: "B.A.S.S., MLF and the NPFL" },
  { href: "/news", label: "News", description: "Event breakdowns and analysis" },
];
