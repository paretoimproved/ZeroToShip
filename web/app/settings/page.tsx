"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import ProtectedLayout from "@/components/ProtectedLayout";
import { api } from "@/lib/api";
import { trackEmailSettingsChanged } from "@/lib/analytics";

const emailFrequencyLabels: Record<string, { title: string; description: string }> = {
  daily: { title: "Daily digest", description: "Get a curated list of ideas every morning" },
  weekly: { title: "Weekly digest", description: "A weekly roundup of the best ideas" },
  none: { title: "No emails", description: "Only check ideas on the dashboard" },
};

export default function SettingsPage() {
  const [emailFrequency, setEmailFrequency] = useState<"daily" | "weekly" | "none">("daily");
  const [saved, setSaved] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    api.getCurrentUser().then((user) => {
      if (user.preferences?.emailFrequency) {
        setEmailFrequency(user.preferences.emailFrequency);
      }
    }).catch(() => {
      // Silently fall back to default if fetch fails
    });
  }, []);

  const handleSave = async () => {
    try {
      await api.updatePreferences({ emailFrequency });
      trackEmailSettingsChanged({
        frequency: emailFrequency,
        categories: [],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  return (
    <ProtectedLayout>
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
              const isSelected = emailFrequency === frequency;
              const label = emailFrequencyLabels[frequency];
              return (
                <button
                  key={frequency}
                  onClick={() => {
                    setEmailFrequency(frequency);
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
              const isActive = mounted && theme === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
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
    </ProtectedLayout>
  );
}
