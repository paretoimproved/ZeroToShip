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
  title: "ZeroToShip — Ship Ideas, Not Guesses",
  description:
    "Every morning, ZeroToShip scrapes 300+ posts from Reddit, HN, and GitHub, clusters real pain points, and delivers 10 scored startup ideas with full business briefs. Wake up to signal, not noise.",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "ZeroToShip — Ship Ideas, Not Guesses",
    description:
      "Scrapes Reddit, HN, and GitHub daily. Delivers 10 scored startup ideas with full business briefs every morning.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZeroToShip — Ship Ideas, Not Guesses",
    description:
      "Scrapes Reddit, HN, and GitHub daily. Delivers 10 scored startup ideas with full business briefs every morning.",
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
