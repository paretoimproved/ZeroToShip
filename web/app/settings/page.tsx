"use client";

import { useState } from "react";
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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);

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
    // In production: await api.updatePreferences(settings);
    console.log("Saving settings:", settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Customize your IdeaForge experience
        </p>
      </header>

      <div className="space-y-8">
        {/* Email Preferences */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Email Notifications
          </h2>

          <div className="space-y-3">
            {(["daily", "weekly", "none"] as const).map((frequency) => (
              <label key={frequency} className="flex items-center">
                <input
                  type="radio"
                  name="emailFrequency"
                  value={frequency}
                  checked={settings.emailFrequency === frequency}
                  onChange={(e) => {
                    setSettings((prev) => ({
                      ...prev,
                      emailFrequency: e.target.value as typeof frequency,
                    }));
                    setSaved(false);
                  }}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-3 text-gray-700 dark:text-gray-300 capitalize">
                  {frequency === "none" ? "No emails" : `${frequency} digest`}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Preferred Categories
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select the types of ideas you&apos;re most interested in
          </p>

          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((category) => (
              <button
                key={category.value}
                onClick={() => handleCategoryToggle(category.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  settings.categories.includes(category.value)
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </section>

        {/* Effort Filter */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Effort Preferences
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Show ideas that match your available time commitment
          </p>

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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quality Threshold
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Only show ideas with a priority score above this threshold
          </p>

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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Appearance
          </h2>

          <div className="flex gap-3">
            {(["system", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setSettings((prev) => ({ ...prev, darkMode: mode }));
                  setSaved(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  settings.darkMode === mode
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </section>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-4">
          {saved && (
            <span className="text-green-600 dark:text-green-400 text-sm">
              Settings saved!
            </span>
          )}
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
