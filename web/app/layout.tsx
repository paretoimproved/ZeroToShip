import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ClientProviders from "@/components/ClientProviders";
import TierSwitcher from "@/components/TierSwitcher";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zerotoship.dev"),
  title: "ZeroToShip — Real Problems, Agent-Ready Specs",
  description:
    "ZeroToShip scrapes Reddit, Hacker News, and GitHub daily, clusters validated problems people are complaining about, and generates agent-ready specs you can hand to Claude Code or Cursor. Find a real problem, start building tonight.",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "ZeroToShip — Real Problems, Agent-Ready Specs",
    description:
      "Scrapes Reddit, Hacker News, and GitHub daily. Surfaces validated problems and generates agent-ready specs you can ship tonight.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZeroToShip — Real Problems, Agent-Ready Specs",
    description:
      "Scrapes Reddit, Hacker News, and GitHub daily. Surfaces validated problems and generates agent-ready specs you can ship tonight.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <ClientProviders>
          <NavBar />
          <main className="pb-16">{children}</main>
          <TierSwitcher />
        </ClientProviders>
      </body>
    </html>
  );
}
