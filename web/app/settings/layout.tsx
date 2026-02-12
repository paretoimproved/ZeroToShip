import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings - ZeroToShip",
  description: "Customize your ZeroToShip notification preferences and appearance.",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
