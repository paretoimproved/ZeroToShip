import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BookmarkButton from "../BookmarkButton";

// Mock the API client
vi.mock("@/lib/api", () => ({
  api: {
    saveIdea: vi.fn(),
    unsaveIdea: vi.fn(),
  },
}));

import { api } from "@/lib/api";

const mockSaveIdea = vi.mocked(api.saveIdea);
const mockUnsaveIdea = vi.mocked(api.unsaveIdea);

describe("BookmarkButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveIdea.mockResolvedValue({ success: true, message: "Idea saved" });
    mockUnsaveIdea.mockResolvedValue({ success: true, message: "Idea removed from saved" });
  });

  it("renders outline icon when not saved", () => {
    render(<BookmarkButton ideaId="test-1" />);

    const button = screen.getByRole("button", { name: "Save idea" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "false");

    // SVG should have fill="none" (outline)
    const svg = button.querySelector("svg");
    expect(svg).toHaveAttribute("fill", "none");
  });

  it("renders filled icon when saved", () => {
    render(<BookmarkButton ideaId="test-1" initialSaved />);

    const button = screen.getByRole("button", { name: "Remove from saved ideas" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "true");

    // SVG should have fill="currentColor" (filled)
    const svg = button.querySelector("svg");
    expect(svg).toHaveAttribute("fill", "currentColor");
  });

  it("calls saveIdea API on click when not saved", async () => {
    const user = userEvent.setup();
    render(<BookmarkButton ideaId="idea-42" />);

    const button = screen.getByRole("button", { name: "Save idea" });
    await user.click(button);

    expect(mockSaveIdea).toHaveBeenCalledWith("idea-42");
    expect(mockUnsaveIdea).not.toHaveBeenCalled();
  });

  it("calls unsaveIdea API on click when already saved", async () => {
    const user = userEvent.setup();
    render(<BookmarkButton ideaId="idea-42" initialSaved />);

    const button = screen.getByRole("button", { name: "Remove from saved ideas" });
    await user.click(button);

    expect(mockUnsaveIdea).toHaveBeenCalledWith("idea-42");
    expect(mockSaveIdea).not.toHaveBeenCalled();
  });

  it("toggles saved state optimistically on click", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<BookmarkButton ideaId="idea-42" onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: "Save idea" });
    await user.click(button);

    // Should immediately toggle to saved
    expect(onToggle).toHaveBeenCalledWith(true);

    // Wait for API to resolve
    await waitFor(() => {
      expect(mockSaveIdea).toHaveBeenCalled();
    });

    // Button should now show as saved
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("reverts optimistic toggle on API error", async () => {
    mockSaveIdea.mockRejectedValueOnce(new Error("Network error"));

    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<BookmarkButton ideaId="idea-42" onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: "Save idea" });
    await user.click(button);

    // Optimistic: toggled to saved
    expect(onToggle).toHaveBeenCalledWith(true);

    // After error: reverted to unsaved
    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(false);
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("reverts optimistic unsave on API error", async () => {
    mockUnsaveIdea.mockRejectedValueOnce(new Error("Network error"));

    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<BookmarkButton ideaId="idea-42" initialSaved onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: "Remove from saved ideas" });
    await user.click(button);

    // Optimistic: toggled to unsaved
    expect(onToggle).toHaveBeenCalledWith(false);

    // After error: reverted to saved
    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(true);
    });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("prevents double-clicks while pending", async () => {
    // Make saveIdea slow
    mockSaveIdea.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, message: "OK" }), 100))
    );

    const user = userEvent.setup();
    render(<BookmarkButton ideaId="idea-42" />);

    const button = screen.getByRole("button", { name: "Save idea" });
    await user.click(button);
    await user.click(button);

    // Should only call once despite two clicks
    expect(mockSaveIdea).toHaveBeenCalledTimes(1);
  });

  it("stops click event propagation", async () => {
    const parentClick = vi.fn();
    const user = userEvent.setup();

    render(
      <div onClick={parentClick}>
        <BookmarkButton ideaId="idea-42" />
      </div>
    );

    const button = screen.getByRole("button", { name: "Save idea" });
    await user.click(button);

    expect(parentClick).not.toHaveBeenCalled();
  });
});
