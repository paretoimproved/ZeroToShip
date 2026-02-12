import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In - ZeroToShip",
  description:
    "Log in to your ZeroToShip account to view today's startup ideas and manage your settings.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
