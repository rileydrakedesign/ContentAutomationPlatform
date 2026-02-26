import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://agentsforx.com"),
  title: "Agents For X",
  description: "AI agents that live inside your X timeline",
  openGraph: {
    type: "website",
    url: "https://agentsforx.com/",
    title: "Agents For X",
    description: "AI agents that live inside your X timeline",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Agents For X",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agents For X",
    description: "AI agents that live inside your X timeline",
    images: ["/og.png"],
  },
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
        {children}
      </body>
    </html>
  );
}
