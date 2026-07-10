import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SubscriptionProvider } from "@/components/auth/SubscriptionProvider";
import { SidebarProvider, Sidebar } from "@/components/sidebar";
import { OnboardingGate } from "@/components/onboarding";

// GALLEY: monospace everywhere. JetBrains Mono drives --font-heading/body/mono
// (see globals.css). The writing surface adds iA Writer Quattro via --font-writer.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agents For X",
  description:
    "The real-time writing assistant for X — write posts that sound like you and win with the algorithm.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body className="antialiased min-h-screen">
        <AuthProvider>
          <SubscriptionProvider>
          <SidebarProvider>
            <OnboardingGate>
              <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 px-6 py-8 overflow-auto">
                  <div className="max-w-5xl mx-auto">{children}</div>
                </main>
              </div>
            </OnboardingGate>
          </SidebarProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
