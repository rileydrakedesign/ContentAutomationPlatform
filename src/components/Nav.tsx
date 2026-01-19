"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export function Nav() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  // Don't show nav on auth pages
  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  const navLinks = [
    { href: "/inbox", label: "Inbox" },
    { href: "/sources", label: "Sources" },
    { href: "/inspiration", label: "Inspiration" },
    { href: "/my-posts", label: "My Posts" },
    { href: "/collections", label: "Collections" },
    { href: "/drafts", label: "Drafts" },
  ];

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-semibold text-white">
            Content Pipeline
          </Link>
          {user && (
            <div className="flex gap-6 text-sm">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition ${
                    pathname === link.href || pathname.startsWith(link.href + "/")
                      ? "text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {!loading && user && (
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className={`text-sm transition ${
                pathname === "/settings"
                  ? "text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Settings
            </Link>
            <span className="text-sm text-zinc-500">{user.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-zinc-400 hover:text-white transition"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
