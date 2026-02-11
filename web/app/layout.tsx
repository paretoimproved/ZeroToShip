import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ClientProviders from "@/components/ClientProviders";
import TierSwitcher from "@/components/TierSwitcher";

export const metadata: Metadata = {
  title: "ZeroToShip — Daily Startup Ideas Scraped from Reddit, HN & GitHub",
  description: "Wake up to 10 AI-scored startup ideas with full technical specs, business models, and go-to-market strategies. Scraped from Reddit, Hacker News, and GitHub. Free to start.",
  openGraph: {
    title: "ZeroToShip — Daily Startup Ideas with Full Business Briefs",
    description: "Every morning, get 10 startup ideas scraped from Reddit, HN, and GitHub — scored by AI, with technical specs included.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZeroToShip — Daily Startup Ideas with Full Business Briefs",
    description: "Every morning, get 10 startup ideas scraped from Reddit, HN, and GitHub — scored by AI, with technical specs included.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <ClientProviders>
          <NavBar />
          <main>{children}</main>
          <TierSwitcher />
        </ClientProviders>
      </body>
    </html>
  );
}
