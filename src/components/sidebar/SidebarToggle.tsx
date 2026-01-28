"use client";

import { ChevronLeft } from "lucide-react";
import { useSidebar } from "./SidebarContext";

export function SidebarToggle() {
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center gap-3 px-3 py-2 mx-3 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
      title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <ChevronLeft
        size={20}
        className={`flex-shrink-0 transition-transform duration-300 ${
          isCollapsed ? "rotate-180" : ""
        }`}
      />
      {!isCollapsed && <span className="whitespace-nowrap">Collapse</span>}
    </button>
  );
}
