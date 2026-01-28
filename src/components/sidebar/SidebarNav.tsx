"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart2, PenSquare, Sliders } from "lucide-react";
import { useSidebar } from "./SidebarContext";

const navLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/insights", label: "Insights", icon: BarChart2 },
  { href: "/create", label: "Create", icon: PenSquare },
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
    <nav className="flex-1 overflow-y-auto py-4 px-3">
      <ul className="space-y-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href, link.exact);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  active
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
                title={isCollapsed ? link.label : undefined}
              >
                <Icon
                  size={20}
                  className={`flex-shrink-0 ${active ? "text-violet-500" : ""}`}
                />
                {!isCollapsed && (
                  <span className="whitespace-nowrap">{link.label}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
