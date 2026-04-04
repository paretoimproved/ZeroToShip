export default function OpenClawDemoPitchPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          OpenClaw: Daily Briefs to Daily Execution
        </h1>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          ZeroToShip generates high-signal startup briefs every day. OpenClaw turns the top briefs
          into bounded, auditable execution workflows.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200">
            1) Daily Cron Input
          </h2>
          <div className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <span className="font-medium text-gray-900 dark:text-gray-100">Schedule:</span>{" "}
              daily at 5:00 AM PT (America/Los_Angeles)
            </div>
            <div>
              <span className="font-medium text-gray-900 dark:text-gray-100">Sources:</span>{" "}
              Reddit, Hacker News, GitHub
            </div>
            <div>
              <span className="font-medium text-gray-900 dark:text-gray-100">Output:</span>{" "}
              ranked briefs with evidence, structure, and trace
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200">
            2) OpenClaw Execution
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            <li>Use brief tabs (Problem, Solution, Tech Spec, Sources) as prompt substrate</li>
            <li>Trigger a workflow from the run trace handoff seam</li>
            <li>Produce a 48-hour validation kit (landing page, copy, outreach, pricing)</li>
            <li>Monitor execution via LangGraph trace and admin audit logs</li>
            <li>Keep every step bounded: budgets, retries, circuit breakers</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200">
          Why This Wins
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Compounding signal</div>
            <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              New briefs every day, not one-off idea generation.
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Execution is a seam</div>
            <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              OpenClaw plugs into the existing handoff hook; minimal product surface area.
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Revenue path</div>
            <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Subscription for briefs + paid per-workflow execution runs.
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200">
          The pitch: connect the daily cron to OpenClaw, auto-run the top 1 to 3 briefs, and
          monitor agent workflows end-to-end with trace.
        </div>
      </div>
    </div>
  );
}
