"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useAdmin } from "./AdminProvider";
import Logo from "./Logo";

const navItems = [
  { href: "/dashboard", label: "Today" },
  { href: "/archive", label: "Archive" },
  { href: "/specs", label: "My Specs" },
  { href: "/settings", label: "Settings" },
  { href: "/account", label: "Account" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { isAuthenticated, logout } = useAuth();
  const { isAdmin, tierOverride } = useAdmin();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Track scroll position for sticky styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  // Focus trap within mobile menu
  useEffect(() => {
    if (!isMobileMenuOpen || !mobileMenuRef.current) return;

    const menuElement = mobileMenuRef.current;
    const focusableSelectors =
      'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])';
    const focusableElements =
      menuElement.querySelectorAll<HTMLElement>(focusableSelectors);

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    firstFocusable.focus();

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabTrap);
    return () => document.removeEventListener("keydown", handleTabTrap);
  }, [isMobileMenuOpen]);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
    hamburgerRef.current?.focus();
  }, []);

  // Hide NavBar on pages with their own nav
  if (pathname === "/" || pathname === "/pricing" || pathname === "/explore") return null;

  const focusRingClasses =
    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900";

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-black"
      >
        Skip to content
      </a>
      <nav
        className={`fixed top-0 left-0 right-0 z-40 h-16 transition-colors duration-200 ${
          isScrolled
            ? "backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800"
            : "bg-white dark:bg-gray-900"
        }`}
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link
            href="/"
            className={`text-primary-600 dark:text-primary-400 rounded-md ${focusRingClasses}`}
          >
            <Logo size="sm" />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${focusRingClasses} ${
                  isActive(item.href)
                    ? "text-primary-700 dark:text-primary-300 after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-primary-600 after:dark:bg-primary-400 after:rounded-full"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {isAdmin && (
              <Link
                href="/admin"
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${focusRingClasses} ${
                  pathname.startsWith("/admin")
                    ? "text-amber-700 dark:text-amber-300 after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-amber-600 after:dark:bg-amber-400 after:rounded-full"
                    : "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
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
                className={`ml-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors ${focusRingClasses}`}
              >
                Log out
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            ref={hamburgerRef}
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="app-mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className={`inline-flex items-center justify-center rounded-md p-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white md:hidden ${focusRingClasses}`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </nav>

      {/* Spacer to offset fixed nav */}
      <div className="h-16" />

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          id="app-mobile-menu"
          role="dialog"
          aria-label="Navigation menu"
          className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-gray-900 md:hidden"
        >
          {/* Overlay header */}
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <span className="text-primary-600 dark:text-primary-400">
              <Logo size="sm" />
            </span>
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={closeMobileMenu}
              className={`inline-flex items-center justify-center rounded-md p-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white ${focusRingClasses}`}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Overlay nav links */}
          <div className="flex flex-1 flex-col gap-2 px-4 pt-4 sm:px-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileMenu}
                className={`rounded-lg px-4 py-3 text-lg font-medium transition-colors ${focusRingClasses} ${
                  isActive(item.href)
                    ? "text-primary-700 bg-primary-50 dark:text-primary-300 dark:bg-primary-900/50"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {isAdmin && (
              <>
                <hr className="my-2 border-gray-200 dark:border-gray-700" />
                <Link
                  href="/admin"
                  onClick={closeMobileMenu}
                  className={`rounded-lg px-4 py-3 text-lg font-medium transition-colors ${focusRingClasses} ${
                    pathname.startsWith("/admin")
                      ? "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/50"
                      : "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/50"
                  }`}
                >
                  Admin
                </Link>
              </>
            )}

            {tierOverride && (
              <span className="mx-4 px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 rounded text-xs font-medium self-start">
                {tierOverride}
              </span>
            )}

            {isAuthenticated && (
              <>
                <hr className="my-2 border-gray-200 dark:border-gray-700" />
                <button
                  onClick={() => {
                    closeMobileMenu();
                    logout();
                  }}
                  className={`rounded-lg px-4 py-3 text-lg font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/50 text-left ${focusRingClasses}`}
                >
                  Log out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
