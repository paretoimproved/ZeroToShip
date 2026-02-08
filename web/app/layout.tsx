import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "IdeaForge - Daily Startup Ideas",
  description: "Discover validated startup ideas backed by real market signals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
