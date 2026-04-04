import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unsubscribe - ZeroToShip",
  description: "Manage your ZeroToShip email preferences.",
};

export default function UnsubscribeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
