"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";

interface BookmarkButtonProps {
  ideaId: string;
  initialSaved?: boolean;
  onToggle?: (saved: boolean) => void;
  /** Render as a compact icon-only button (for card corners) */
  size?: "sm" | "md";
}

/**
 * Bookmark/save button for idea cards.
 * Uses optimistic UI: toggles immediately and reverts on API error.
 */
export default function BookmarkButton({
  ideaId,
  initialSaved = false,
  onToggle,
  size = "sm",
}: BookmarkButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  const toggle = useCallback(async () => {
    if (pending) return;

    const nextState = !saved;
    // Optimistic update
    setSaved(nextState);
    onToggle?.(nextState);
    setPending(true);

    try {
      if (nextState) {
        await api.saveIdea(ideaId);
      } else {
        await api.unsaveIdea(ideaId);
      }
    } catch {
      // Revert on error
      setSaved(!nextState);
      onToggle?.(!nextState);
    } finally {
      setPending(false);
    }
  }, [ideaId, saved, pending, onToggle]);

  const sizeClasses =
    size === "sm"
      ? "w-8 h-8"
      : "w-10 h-10";

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      disabled={pending}
      aria-label={saved ? "Remove from saved ideas" : "Save idea"}
      aria-pressed={saved}
      className={`${sizeClasses} inline-flex items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
        saved
          ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/50 hover:bg-primary-100 dark:hover:bg-primary-900/70"
          : "text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
      } ${pending ? "opacity-60" : "cursor-pointer"}`}
    >
      <svg
        className={iconSize}
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    </button>
  );
}
