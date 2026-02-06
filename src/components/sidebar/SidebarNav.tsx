"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart2, PenSquare, Sliders, CalendarClock } from "lucide-react";
import { useSidebar } from "./SidebarContext";

const navLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/insights", label: "Insights", icon: BarChart2 },
  { href: "/create", label: "Create", icon: PenSquare },
  { href: "/queue", label: "Queue", icon: CalendarClock },
  { href: "/voice", label: "Voice", icon: Sliders },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();

  function isActive(href: string, exact?: boolean) {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="flex-1 overflow-y-auto py-4 px-2">
      <ul className="space-y-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href, link.exact);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl
                  transition-all duration-200
                  cursor-pointer
                  ${active
                    ? "bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] shadow-[var(--shadow-glow-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
                  }
                  ${isCollapsed ? "justify-center" : ""}
                `}
                title={isCollapsed ? link.label : undefined}
              >
                <Icon
                  size={20}
                  className={`flex-shrink-0 transition-colors duration-200 ${
                    active ? "text-[var(--color-primary-400)]" : ""
                  }`}
                />
                {!isCollapsed && (
                  <span className="whitespace-nowrap text-sm font-medium">
                    {link.label}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
