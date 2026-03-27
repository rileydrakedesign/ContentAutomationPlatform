"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart2, PenSquare, Sliders, CalendarClock, Target, Lock } from "lucide-react";
import { useSidebar } from "./SidebarContext";
import { useSubscription } from "@/components/auth/SubscriptionProvider";

const navLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/insights", label: "Insights", icon: BarChart2, proFeatures: ["patternExtraction", "insightsChat"] },
  { href: "/create", label: "Create", icon: PenSquare },
  { href: "/queue", label: "Queue", icon: CalendarClock, proFeatures: ["scheduling"] },
  { href: "/voice", label: "Voice", icon: Sliders },
  { href: "/strategy", label: "Strategy", icon: Target },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();
  const { isFreePlan, canUseFeature } = useSubscription();

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
          const hasProFeatures = isFreePlan && link.proFeatures?.some((f) => !canUseFeature(f));

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
                  <>
                    <span className="whitespace-nowrap text-sm font-medium flex-1">
                      {link.label}
                    </span>
                    {hasProFeatures && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] border border-[var(--color-primary-500)]/20">
                        <Lock className="w-2.5 h-2.5" />
                        PRO
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
