"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The Radar desk (/reply) is the one two-pane surface in the app — it needs
// more than the reading measure every other route gets.
export function MainContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wide = pathname === "/reply" || pathname.startsWith("/reply/");
  return <div className={`${wide ? "max-w-[1360px]" : "max-w-5xl"} mx-auto`}>{children}</div>;
}
