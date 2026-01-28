"use client";

import Link from "next/link";
import { useSidebar } from "./SidebarContext";

export function SidebarLogo() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="px-4 py-4 border-b border-slate-800">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
          <span className="text-slate-950 font-bold text-sm">CP</span>
        </div>
        {!isCollapsed && (
          <span className="font-semibold text-white whitespace-nowrap">
            Content Pipeline
          </span>
        )}
      </Link>
    </div>
  );
}
