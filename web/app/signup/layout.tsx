import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - ZeroToShip",
  description:
    "Create your free ZeroToShip account and start receiving AI-curated startup ideas every morning.",
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
