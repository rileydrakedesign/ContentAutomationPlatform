"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSidebar } from "./SidebarContext";
import { SidebarLogo } from "./SidebarLogo";
import { SidebarNav } from "./SidebarNav";
import { SidebarToggle } from "./SidebarToggle";
import { SidebarUserMenu } from "./SidebarUserMenu";

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isCollapsed } = useSidebar();

  // Hide sidebar on auth pages
  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  return (
    <aside
      className={`
        flex flex-col h-screen sticky top-0
        bg-[var(--color-bg-base)]
        border-r border-[var(--color-border-subtle)]
        transition-all duration-300 ease-in-out
        ${isCollapsed ? "w-16" : "w-60"}
      `}
    >
      <SidebarLogo />

      {user && <SidebarNav />}

      <div className="mt-auto border-t border-[var(--color-border-subtle)] p-2">
        <SidebarToggle />
        {!loading && user && <SidebarUserMenu />}
      </div>
    </aside>
  );
}
