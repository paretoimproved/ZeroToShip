"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useAdmin } from "./AdminProvider";

const navItems = [
  { href: "/dashboard", label: "Today" },
  { href: "/archive", label: "Archive" },
  { href: "/settings", label: "Settings" },
  { href: "/account", label: "Account" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { isAuthenticated, logout } = useAuth();
  const { isAdmin, tierOverride } = useAdmin();

  // Hide NavBar on the landing page
  if (pathname === "/") return null;

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-xl font-bold text-primary-600 dark:text-primary-400"
          >
            ZeroToShip
          </Link>

          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                href="/admin"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                    : "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/50"
                }`}
              >
                Admin
              </Link>
            )}

            {tierOverride && (
              <span className="ml-2 px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 rounded text-xs font-medium">
                {tierOverride}
              </span>
            )}

            {isAuthenticated && (
              <button
                onClick={logout}
                className="ml-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
              >
                Log out
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
