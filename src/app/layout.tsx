import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/shell/AppShell";

// Primary body font
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

// Heading font
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

// Monospace font for code/metrics
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Content Pipeline",
  description: "Content automation for X and Instagram",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${spaceGrotesk.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
