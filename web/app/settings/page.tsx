"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { api } from "@/lib/api";
import type { EffortLevel } from "@/lib/types";

interface Settings {
  emailFrequency: "daily" | "weekly" | "none";
  categories: string[];
  effortFilter: EffortLevel[];
  minPriorityScore: number;
  darkMode: "system" | "light" | "dark";
}

const defaultSettings: Settings = {
  emailFrequency: "daily",
  categories: ["developer-tools", "saas", "ai"],
  effortFilter: ["weekend", "week"],
  minPriorityScore: 50,
  darkMode: "system",
};

const categoryOptions = [
  { value: "developer-tools", label: "Developer Tools" },
  { value: "saas", label: "SaaS" },
  { value: "ai", label: "AI/ML" },
  { value: "fintech", label: "Fintech" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "productivity", label: "Productivity" },
  { value: "marketing", label: "Marketing" },
  { value: "health", label: "Health & Fitness" },
];

const effortOptions: { value: EffortLevel; label: string }[] = [
  { value: "weekend", label: "Weekend Projects" },
  { value: "week", label: "1-Week Builds" },
  { value: "month", label: "Month-long Projects" },
  { value: "quarter", label: "Quarter+ Ventures" },
];

const emailFrequencyLabels: Record<string, { title: string; description: string }> = {
  daily: { title: "Daily digest", description: "Get a curated list of ideas every morning" },
  weekly: { title: "Weekly digest", description: "A weekly roundup of the best ideas" },
  none: { title: "No emails", description: "Only check ideas on the dashboard" },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    setIsAuth(isAuthenticated());
  }, []);

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl mb-4">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Sign in to access your settings and customize your experience.
        </p>
        <Link
          href="/landing"
          className="inline-block rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Sign Up
        </Link>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
            Sign In
          </Link>
        </p>
      </div>
    );
  }

  const handleCategoryToggle = (category: string) => {
    setSettings((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
    setSaved(false);
  };

  const handleEffortToggle = (effort: EffortLevel) => {
    setSettings((prev) => ({
      ...prev,
      effortFilter: prev.effortFilter.includes(effort)
        ? prev.effortFilter.filter((e) => e !== effort)
        : [...prev.effortFilter, effort],
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      await api.updatePreferences({
        categories: settings.categories,
        effortFilter: settings.effortFilter,
        emailFrequency: settings.emailFrequency,
        minPriorityScore: settings.minPriorityScore,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Customize your ZeroToShip experience
        </p>
      </header>

      <div className="space-y-8">
        {/* Email Preferences */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Email Notifications
            </h2>
          </div>

          <div className="space-y-3">
            {(["daily", "weekly", "none"] as const).map((frequency) => {
              const isSelected = settings.emailFrequency === frequency;
              const label = emailFrequencyLabels[frequency];
              return (
                <button
                  key={frequency}
                  onClick={() => {
                    setSettings((prev) => ({
                      ...prev,
                      emailFrequency: frequency,
                    }));
                    setSaved(false);
                  }}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? "border-primary-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                    )}
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">
                      {label.title}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {label.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Categories */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Preferred Categories
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select the types of ideas you&apos;re most interested in
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((category) => {
              const isActive = settings.categories.includes(category.value);
              return (
                <button
                  key={category.value}
                  onClick={() => handleCategoryToggle(category.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-800"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Effort Filter */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Effort Preferences
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Show ideas that match your available time commitment
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {effortOptions.map((effort) => (
              <label key={effort.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.effortFilter.includes(effort.value)}
                  onChange={() => handleEffortToggle(effort.value)}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500 rounded"
                />
                <span className="ml-3 text-gray-700 dark:text-gray-300">
                  {effort.label}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Minimum Score */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Quality Threshold
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Only show ideas with a priority score above this threshold
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Minimum Score
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {settings.minPriorityScore}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.minPriorityScore}
              onChange={(e) => {
                setSettings((prev) => ({
                  ...prev,
                  minPriorityScore: Number(e.target.value),
                }));
                setSaved(false);
              }}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>Show all</span>
              <span>Top quality only</span>
            </div>
          </div>
        </section>

        {/* Theme */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Appearance
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(
              [
                {
                  mode: "system" as const,
                  label: "System",
                  icon: (
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                },
                {
                  mode: "light" as const,
                  label: "Light",
                  icon: (
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ),
                },
                {
                  mode: "dark" as const,
                  label: "Dark",
                  icon: (
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ),
                },
              ]
            ).map(({ mode, label, icon }) => {
              const isActive = settings.darkMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => {
                    setSettings((prev) => ({ ...prev, darkMode: mode }));
                    setSaved(false);
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isActive
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    {icon}
                  </div>
                  <span className={`text-sm font-medium ${
                    isActive
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-gray-700 dark:text-gray-300"
                  }`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-4">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm animate-fade-in">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Settings saved!
            </span>
          )}
          <button
            onClick={handleSave}
            className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
