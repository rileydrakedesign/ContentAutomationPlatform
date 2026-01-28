"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSidebar } from "./SidebarContext";

export function SidebarUserMenu() {
  const { user, signOut } = useAuth();
  const { isCollapsed } = useSidebar();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.email ? user.email.slice(0, 2).toUpperCase() : "??";

  return (
    <div className="relative px-3 pb-4" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-white transition-colors ${
          isOpen ? "bg-slate-900 text-white" : ""
        }`}
        title={isCollapsed ? user.email || "User menu" : undefined}
      >
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-300 flex-shrink-0">
          {initials}
        </div>
        {!isCollapsed && (
          <span className="truncate text-sm">{user.email}</span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute bottom-full mb-2 ${
            isCollapsed ? "left-0" : "left-3 right-3"
          } bg-slate-900 border border-slate-800 rounded-lg py-1 z-50 min-w-[180px]`}
        >
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
          >
            <Settings size={16} />
            Settings
          </Link>

          <button
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
            className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
