"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export default function LandingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Track scroll position for sticky styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    handleScroll(); // Check initial position
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

    // Focus the close button when menu opens
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

  const focusRingClasses =
    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900";

  return (
    <>
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      <header
        className={`fixed top-0 left-0 right-0 z-50 h-16 transition-colors duration-200 ${
          isScrolled
            ? "backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800"
            : "bg-transparent"
        }`}
      >
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6"
        >
          {/* Logo */}
          <Link
            href="/"
            className={`text-xl font-bold text-gray-900 dark:text-white rounded-md ${focusRingClasses}`}
          >
            ZeroToShip
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white ${focusRingClasses}`}
              >
                {link.label}
              </a>
            ))}

            <div className="ml-4 h-5 w-px bg-gray-300 dark:bg-gray-700" />

            <Link
              href="/login"
              className={`ml-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white ${focusRingClasses}`}
            >
              Sign In
            </Link>

            <Link
              href="/signup"
              className={`ml-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 ${focusRingClasses}`}
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={hamburgerRef}
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
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
        </nav>
      </header>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          id="mobile-menu"
          role="dialog"
          aria-label="Navigation menu"
          className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-gray-900 md:hidden"
        >
          {/* Overlay header */}
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              ZeroToShip
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
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className={`rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 ${focusRingClasses}`}
              >
                {link.label}
              </a>
            ))}

            <hr className="my-2 border-gray-200 dark:border-gray-700" />

            <Link
              href="/login"
              onClick={closeMobileMenu}
              className={`rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 ${focusRingClasses}`}
            >
              Sign In
            </Link>

            <Link
              href="/signup"
              onClick={closeMobileMenu}
              className={`mt-2 rounded-lg bg-primary-600 px-4 py-3 text-center text-lg font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 ${focusRingClasses}`}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
