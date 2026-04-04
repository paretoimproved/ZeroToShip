import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ZeroToShip Startup Idea Brief";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

interface IdeaOGData {
  name: string;
  tagline: string;
  priorityScore: number;
  effortEstimate: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  return "#ef4444";
}

function getEffortLabel(effort: string): string {
  switch (effort) {
    case "weekend":
      return "Weekend";
    case "week":
      return "1 Week";
    case "month":
      return "1 Month";
    case "quarter":
      return "Quarter";
    default:
      return effort;
  }
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let idea: IdeaOGData | null = null;
  try {
    const res = await fetch(`${API_BASE_URL}/ideas/${id}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data: { idea: IdeaOGData } = await res.json();
      idea = data.idea ?? null;
    }
  } catch {
    // Fall through to fallback
  }

  if (!idea) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            backgroundColor: "#09090b",
            color: "#fafafa",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700 }}>
            ZeroToShip
          </div>
          <div
            style={{ display: "flex", fontSize: 24, color: "#a1a1aa", marginTop: 16 }}
          >
            Startup Idea Brief
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const scoreColor = getScoreColor(idea.priorityScore);
  const effortLabel = getEffortLabel(idea.effortEstimate);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          padding: 60,
        }}
      >
        {/* Top bar: ZeroToShip branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 48,
          }}
        >
          {/* Logo icon */}
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <circle cx="6" cy="26" r="3" fill="#6366f1" />
            <line
              x1="8"
              y1="24"
              x2="22"
              y2="10"
              stroke="#fafafa"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M19 6 L26 6 L26 13"
              stroke="#fafafa"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "#a1a1aa",
            }}
          >
            ZeroToShip
          </div>
        </div>

        {/* Idea name */}
        <div
          style={{
            display: "flex",
            fontSize: idea.name.length > 40 ? 44 : 56,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            maxWidth: "90%",
          }}
        >
          {idea.name}
        </div>

        {/* Tagline */}
        {idea.tagline && (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#a1a1aa",
              marginTop: 20,
              lineHeight: 1.4,
              maxWidth: "85%",
            }}
          >
            {idea.tagline.length > 120
              ? idea.tagline.slice(0, 117) + "..."
              : idea.tagline}
          </div>
        )}

        {/* Bottom row: Score badge + Effort */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginTop: "auto",
          }}
        >
          {/* Score badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#18181b",
              border: `2px solid ${scoreColor}`,
              borderRadius: 12,
              padding: "10px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 36,
                fontWeight: 700,
                color: scoreColor,
              }}
            >
              {idea.priorityScore}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: "#a1a1aa",
              }}
            >
              / 100
            </div>
          </div>

          {/* Effort pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 12,
              padding: "10px 20px",
            }}
          >
            <div style={{ display: "flex", fontSize: 18, color: "#a1a1aa" }}>
              Effort:
            </div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 600 }}>
              {effortLabel}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
