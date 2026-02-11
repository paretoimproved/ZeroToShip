"use client";

import { useState, useRef, useEffect } from "react";
import { useAdmin } from "./AdminProvider";

const TIER_OPTIONS = [
  { value: null, label: "Real (Admin)" },
  { value: "anonymous", label: "Anonymous" },
  { value: "free", label: "Free" },
  { value: "pro", label: "Builder" },
  { value: "enterprise", label: "Enterprise" },
] as const;

export default function TierSwitcher() {
  const { isAdmin, tierOverride, setTierOverride } = useAdmin();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!isAdmin) return null;

  const isOverrideActive = tierOverride !== null;
  const currentLabel =
    TIER_OPTIONS.find((o) => o.value === tierOverride)?.label || "Real (Admin)";

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {TIER_OPTIONS.map((option) => {
            const isSelected = option.value === tierOverride;
            return (
              <button
                key={option.label}
                onClick={() => {
                  setTierOverride(option.value as "anonymous" | "free" | "pro" | "enterprise" | null);
                  setIsOpen(false);
                }}
                className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                  isSelected
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-4 py-2 rounded-full text-sm font-medium shadow-lg transition-colors ${
          isOverrideActive
            ? "bg-amber-500 text-white hover:bg-amber-600"
            : "bg-gray-700 text-white hover:bg-gray-600"
        }`}
      >
        {isOverrideActive ? `Viewing as: ${currentLabel}` : "Tier Switcher"}
      </button>
    </div>
  );
}
