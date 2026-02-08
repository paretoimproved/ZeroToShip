"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { AdminStatsOverview, PipelineStatus } from "@/lib/types";

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStatsOverview | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, healthData] = await Promise.all([
          api.getAdminStats(),
          api.getSystemHealth(),
        ]);
        setStats(statsData);
        setHealth(healthData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Admin Dashboard
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} />
        <StatCard label="Active Subscribers" value={stats?.activeSubscribers ?? 0} />
        <StatCard label="Ideas Today" value={stats?.ideasToday ?? 0} />
        <StatCard label="Total Ideas" value={stats?.totalIdeas ?? 0} />
      </div>

      {/* Pipeline Status Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Pipeline Status
          </h2>
          <div className="flex items-center space-x-2">
            <Link
              href="/admin/runs"
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Run History
            </Link>
            <Link
              href="/admin/pipeline"
              className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
            >
              Run Pipeline
            </Link>
          </div>
        </div>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <span className="font-medium">Last Run:</span>{" "}
            {stats?.pipeline.lastRunId || "No runs yet"}
          </p>
          <p>
            <span className="font-medium">Last Run At:</span>{" "}
            {stats?.pipeline.lastRunAt
              ? new Date(stats.pipeline.lastRunAt).toLocaleString()
              : "N/A"}
          </p>
          <p>
            <span className="font-medium">Uptime:</span>{" "}
            {health?.uptime
              ? `${Math.floor(Number(health.uptime) / 3600)}h ${Math.floor(
                  (Number(health.uptime) % 3600) / 60
                )}m`
              : "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
