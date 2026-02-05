"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider } from "@/components/sidebar";

function isMarketingPath(pathname: string) {
  return pathname === "/agent-for-x" || pathname.startsWith("/agent-for-x/");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const marketing = isMarketingPath(pathname);

  if (marketing) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 px-6 py-8 overflow-auto">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
