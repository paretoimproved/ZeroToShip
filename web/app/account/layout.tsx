import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account - ZeroToShip",
  description:
    "Manage your ZeroToShip subscription, billing, and API keys.",
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
