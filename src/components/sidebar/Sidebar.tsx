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
      className={`flex flex-col bg-slate-950 border-r border-slate-800 transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-56"
      }`}
    >
      <SidebarLogo />

      {user && <SidebarNav />}

      <div className="border-t border-slate-800 pt-2">
        <SidebarToggle />
        {!loading && user && <SidebarUserMenu />}
      </div>
    </aside>
  );
}
