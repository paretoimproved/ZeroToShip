import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import IdeaBriefCard from "../IdeaBriefCard";
import type { IdeaBrief } from "@/lib/types";

// Mock next/link to render as a plain anchor
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function makeBrief(overrides: Partial<IdeaBrief> = {}): IdeaBrief {
  return {
    id: "brief-1",
    name: "TestIdea",
    tagline: "A tagline for testing",
    priorityScore: 85,
    effortEstimate: "week",
    revenueEstimate: "$10k per month",
    problemStatement: "People struggle with X",
    targetAudience: "Developers",
    marketSize: "$1B TAM",
    existingSolutions: "Tool A, Tool B",
    gaps: "No one does Y well",
    proposedSolution: "Build a better Y",
    keyFeatures: ["Feature One", "Feature Two"],
    mvpScope: "Core feature set in 2 weeks",
    technicalSpec: {
      stack: ["React", "Node.js"],
      architecture: "Monolith to start",
      estimatedEffort: "2 weeks",
    },
    businessModel: {
      pricing: "Freemium",
      revenueProjection: "$10k per month in 6 months",
      monetizationPath: "SaaS subscriptions",
    },
    goToMarket: {
      launchStrategy: "Product Hunt launch",
      channels: ["Reddit", "Hacker News"],
      firstCustomers: "Indie hackers",
    },
    risks: ["Market timing"],
    generatedAt: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

describe("IdeaBriefCard", () => {
  it("renders idea name, tagline, and priority score", () => {
    const brief = makeBrief();
    render(<IdeaBriefCard brief={brief} />);

    expect(screen.getByText("TestIdea")).toBeInTheDocument();
    expect(screen.getByText("A tagline for testing")).toBeInTheDocument();
    expect(screen.getByText("Score 85/100")).toBeInTheDocument();
  });

  it("renders correct tab labels without sources", () => {
    const brief = makeBrief({ sources: undefined });
    render(<IdeaBriefCard brief={brief} />);

    expect(screen.getByRole("tab", { name: "Problem" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Solution" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tech Spec" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Business" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Sources" })).not.toBeInTheDocument();
  });

  it("renders Sources tab when sources are present", () => {
    const brief = makeBrief({
      sources: [
        {
          platform: "reddit",
          title: "A reddit post",
          url: "https://reddit.com/r/test",
          score: 42,
          commentCount: 10,
          postedAt: "2026-01-10T00:00:00Z",
        },
      ],
    });
    render(<IdeaBriefCard brief={brief} />);

    expect(screen.getByRole("tab", { name: "Sources" })).toBeInTheDocument();
  });

  it("defaults to the problem tab", () => {
    render(<IdeaBriefCard brief={makeBrief()} />);

    const problemTab = screen.getByRole("tab", { name: "Problem" });
    expect(problemTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("People struggle with X")).toBeInTheDocument();
  });

  it("respects defaultTab prop", () => {
    render(<IdeaBriefCard brief={makeBrief()} defaultTab="solution" />);

    const solutionTab = screen.getByRole("tab", { name: "Solution" });
    expect(solutionTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Build a better Y")).toBeInTheDocument();
  });

  it("switches tabs on click and shows correct content", async () => {
    const user = userEvent.setup();
    render(<IdeaBriefCard brief={makeBrief()} />);

    // Start on problem tab
    expect(screen.getByText("People struggle with X")).toBeInTheDocument();

    // Click solution tab
    await user.click(screen.getByRole("tab", { name: "Solution" }));
    expect(screen.getByRole("tab", { name: "Solution" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Build a better Y")).toBeInTheDocument();

    // Click tech spec tab
    await user.click(screen.getByRole("tab", { name: "Tech Spec" }));
    expect(screen.getByRole("tab", { name: "Tech Spec" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Monolith to start")).toBeInTheDocument();

    // Click business tab
    await user.click(screen.getByRole("tab", { name: "Business" }));
    expect(screen.getByRole("tab", { name: "Business" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Freemium")).toBeInTheDocument();
  });

  it("shows gated overlay on protected tabs when gated=true", async () => {
    const user = userEvent.setup();
    render(<IdeaBriefCard brief={makeBrief()} gated />);

    // Problem tab is not gated, should show content
    expect(screen.getByText("People struggle with X")).toBeInTheDocument();
    expect(screen.queryByTestId("gated-content")).not.toBeInTheDocument();

    // Switch to solution tab (gated)
    await user.click(screen.getByRole("tab", { name: "Solution" }));
    expect(screen.getByTestId("gated-content")).toBeInTheDocument();
    expect(screen.getByText("Full Analysis Locked")).toBeInTheDocument();

    // Switch to tech spec tab (gated)
    await user.click(screen.getByRole("tab", { name: "Tech Spec" }));
    expect(screen.getByTestId("gated-content")).toBeInTheDocument();

    // Switch to business tab (gated)
    await user.click(screen.getByRole("tab", { name: "Business" }));
    expect(screen.getByTestId("gated-content")).toBeInTheDocument();

    // Switch back to problem tab (not gated)
    await user.click(screen.getByRole("tab", { name: "Problem" }));
    expect(screen.queryByTestId("gated-content")).not.toBeInTheDocument();
    expect(screen.getByText("People struggle with X")).toBeInTheDocument();
  });

  it("does not show gated overlay when gated=false", async () => {
    const user = userEvent.setup();
    render(<IdeaBriefCard brief={makeBrief()} />);

    await user.click(screen.getByRole("tab", { name: "Solution" }));
    expect(screen.queryByTestId("gated-content")).not.toBeInTheDocument();
    expect(screen.getByText("Build a better Y")).toBeInTheDocument();
  });

  it("renders sources tab content correctly", async () => {
    const user = userEvent.setup();
    const brief = makeBrief({
      sources: [
        {
          platform: "reddit",
          title: "Cool Reddit Post",
          url: "https://reddit.com/r/test/123",
          score: 42,
          commentCount: 15,
          postedAt: "2026-01-10T00:00:00Z",
        },
      ],
    });
    render(<IdeaBriefCard brief={brief} />);

    await user.click(screen.getByRole("tab", { name: "Sources" }));
    expect(screen.getByText("Cool Reddit Post")).toBeInTheDocument();
    expect(screen.getByText("42 points · 15 comments")).toBeInTheDocument();
  });

  it("navigates tabs with arrow keys", async () => {
    const user = userEvent.setup();
    render(<IdeaBriefCard brief={makeBrief()} />);

    const problemTab = screen.getByRole("tab", { name: "Problem" });
    problemTab.focus();

    // ArrowRight to next tab
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Solution" })).toHaveAttribute("aria-selected", "true");

    // ArrowRight again
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Tech Spec" })).toHaveAttribute("aria-selected", "true");

    // ArrowLeft back
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Solution" })).toHaveAttribute("aria-selected", "true");
  });
});
