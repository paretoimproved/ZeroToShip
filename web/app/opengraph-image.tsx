import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ZeroToShip — Ship Ideas, Not Guesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
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
        {/* Logo icon */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 32 32"
          fill="none"
        >
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

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            marginTop: 24,
          }}
        >
          ZeroToShip
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#a1a1aa",
            marginTop: 16,
          }}
        >
          Ship ideas, not guesses.
        </div>
      </div>
    ),
    { ...size }
  );
}
