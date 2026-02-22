type CellStatus = "yes" | "no" | "partial" | "text";

interface ComparisonRow {
  feature: string;
  zerotoship: { status: CellStatus; label: string };
  manual: { status: CellStatus; label: string };
  aiTools: { status: CellStatus; label: string };
}

const COMPARISON_DATA: ComparisonRow[] = [
  {
    feature: "Daily problem discovery",
    zerotoship: { status: "yes", label: "Yes" },
    manual: { status: "no", label: "No" },
    aiTools: { status: "no", label: "No" },
  },
  {
    feature: "Multi-source scraping",
    zerotoship: { status: "yes", label: "Yes (4 platforms)" },
    manual: { status: "partial", label: "Partial (1-2 at a time)" },
    aiTools: { status: "no", label: "No" },
  },
  {
    feature: "AI scoring & ranking",
    zerotoship: { status: "yes", label: "Yes" },
    manual: { status: "no", label: "No" },
    aiTools: { status: "no", label: "No" },
  },
  {
    feature: "Agent-ready specs",
    zerotoship: { status: "yes", label: "Yes" },
    manual: { status: "no", label: "No" },
    aiTools: { status: "partial", label: "Partial" },
  },
  {
    feature: "Technical specs",
    zerotoship: { status: "yes", label: "Yes" },
    manual: { status: "no", label: "No" },
    aiTools: { status: "partial", label: "Partial" },
  },
  {
    feature: "Go-to-market plan",
    zerotoship: { status: "yes", label: "Yes" },
    manual: { status: "no", label: "No" },
    aiTools: { status: "partial", label: "Partial" },
  },
  {
    feature: "Time investment",
    zerotoship: { status: "text", label: "5 min/day" },
    manual: { status: "text", label: "2-3 hours/day" },
    aiTools: { status: "text", label: "30+ min/day" },
  },
  {
    feature: "Price",
    zerotoship: { status: "text", label: "Free – $19/mo" },
    manual: { status: "text", label: "Your time ($50-100/hr)" },
    aiTools: { status: "text", label: "$20+/mo" },
  },
];

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="inline-block mr-1.5 text-green-500"
    >
      <path
        d="M3 8.5l3.5 3.5L13 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="inline-block mr-1.5 text-red-500"
    >
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PartialIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="inline-block mr-1.5 text-yellow-500"
    >
      <path
        d="M3 8h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatusCell({ status, label }: { status: CellStatus; label: string }) {
  if (status === "text") {
    return <span>{label}</span>;
  }

  return (
    <span className="inline-flex items-center">
      {status === "yes" && (
        <>
          <CheckIcon />
          <span className="sr-only">Yes</span>
        </>
      )}
      {status === "no" && (
        <>
          <XIcon />
          <span className="sr-only">No</span>
        </>
      )}
      {status === "partial" && (
        <>
          <PartialIcon />
          <span className="sr-only">Partial</span>
        </>
      )}
      <span>{label}</span>
    </span>
  );
}

function MobileStatusIcon({ status }: { status: CellStatus }) {
  if (status === "yes") return <CheckIcon />;
  if (status === "no") return <XIcon />;
  if (status === "partial") return <PartialIcon />;
  return null;
}

function DesktopTable() {
  return (
    <div className="hidden md:block overflow-x-auto">
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Feature comparison between ZeroToShip, manual research, and AI tools
          </caption>
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th
                scope="col"
                className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-left"
              >
                Feature
              </th>
              <th
                scope="col"
                className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-left bg-primary-50 dark:bg-primary-900/30"
              >
                ZeroToShip
              </th>
              <th
                scope="col"
                className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-left"
              >
                Manual Research
              </th>
              <th
                scope="col"
                className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-left"
              >
                ChatGPT / AI Tools
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_DATA.map((row, index) => (
              <tr
                key={row.feature}
                className={
                  index % 2 === 1
                    ? "bg-gray-50 dark:bg-gray-800/30"
                    : "bg-white dark:bg-gray-900"
                }
              >
                <th
                  scope="row"
                  className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-left"
                >
                  {row.feature}
                </th>
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 bg-primary-50 dark:bg-primary-900/30">
                  <StatusCell status={row.zerotoship.status} label={row.zerotoship.label} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                  <StatusCell status={row.manual.status} label={row.manual.label} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                  <StatusCell status={row.aiTools.status} label={row.aiTools.label} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileCards() {
  return (
    <div className="md:hidden space-y-4">
      {COMPARISON_DATA.map((row) => (
        <div
          key={row.feature}
          className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700"
        >
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
            {row.feature}
          </h3>
          <dl className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <dt className="text-gray-600 dark:text-gray-400">ZeroToShip</dt>
              <dd className="text-gray-900 dark:text-white font-medium inline-flex items-center">
                <MobileStatusIcon status={row.zerotoship.status} />
                {row.zerotoship.status === "text" ? (
                  <span>{row.zerotoship.label}</span>
                ) : (
                  <>
                    <span className="sr-only">
                      {row.zerotoship.status === "yes"
                        ? "Yes"
                        : row.zerotoship.status === "no"
                          ? "No"
                          : "Partial"}
                    </span>
                    <span>{row.zerotoship.label}</span>
                  </>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between text-sm">
              <dt className="text-gray-600 dark:text-gray-400">Manual</dt>
              <dd className="text-gray-900 dark:text-white font-medium inline-flex items-center">
                <MobileStatusIcon status={row.manual.status} />
                {row.manual.status === "text" ? (
                  <span>{row.manual.label}</span>
                ) : (
                  <>
                    <span className="sr-only">
                      {row.manual.status === "yes"
                        ? "Yes"
                        : row.manual.status === "no"
                          ? "No"
                          : "Partial"}
                    </span>
                    <span>{row.manual.label}</span>
                  </>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between text-sm">
              <dt className="text-gray-600 dark:text-gray-400">AI Tools</dt>
              <dd className="text-gray-900 dark:text-white font-medium inline-flex items-center">
                <MobileStatusIcon status={row.aiTools.status} />
                {row.aiTools.status === "text" ? (
                  <span>{row.aiTools.label}</span>
                ) : (
                  <>
                    <span className="sr-only">
                      {row.aiTools.status === "yes"
                        ? "Yes"
                        : row.aiTools.status === "no"
                          ? "No"
                          : "Partial"}
                    </span>
                    <span>{row.aiTools.label}</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}

export default function ComparisonTable() {
  return (
    <section
      aria-labelledby="comparison-heading"
      className="py-20 px-4 bg-gray-50 dark:bg-gray-800/50"
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2
            id="comparison-heading"
            className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl"
          >
            ZeroToShip vs. Finding Problems Yourself
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            See how much time and effort you save.
          </p>
        </div>

        <DesktopTable />
        <MobileCards />
      </div>
    </section>
  );
}
