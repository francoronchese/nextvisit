import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SlotGrid } from "../src/features/booking";
import type { Slot } from "@nextvisit/shared";

const MONDAY_SLOTS: Slot[] = [
  { date: "2026-09-07", startTime: "09:00", endTime: "09:30", available: true },
  { date: "2026-09-07", startTime: "09:30", endTime: "10:00", available: true },
  { date: "2026-09-07", startTime: "10:00", endTime: "10:30", available: false },
  { date: "2026-09-07", startTime: "10:30", endTime: "11:00", available: false },
  { date: "2026-09-07", startTime: "11:00", endTime: "11:30", available: true },
];

describe("SlotGrid", () => {
  it("shows each date as a heading followed by its time slots", async () => {
    render(
      <SlotGrid
        slots={MONDAY_SLOTS}
        loading={false}
        error={null}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(await screen.findByRole("heading", { name: /Lunes, 7 de septiembre/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /09:00/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /11:00/ })).toBeInTheDocument();
  });

  it("visually distinguishes available from unavailable slots", async () => {
    render(
      <SlotGrid
        slots={MONDAY_SLOTS}
        loading={false}
        error={null}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /09:00/ })).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("button", { name: /10:00/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /10:30/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("selects an available slot on click and not an unavailable one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SlotGrid slots={MONDAY_SLOTS} loading={false} error={null} onSelect={onSelect} onRetry={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /09:00/ }));
    expect(onSelect).toHaveBeenCalledWith(MONDAY_SLOTS[0]);

    await user.click(screen.getByRole("button", { name: /10:00/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows a loading message while loading", () => {
    render(<SlotGrid slots={[]} loading error={null} onSelect={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("shows an error with a retry button when the fetch fails", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<SlotGrid slots={[]} loading={false} error="boom" onSelect={vi.fn()} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows an empty message when there are no slots", () => {
    render(<SlotGrid slots={[]} loading={false} error={null} onSelect={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText(/No available slots/)).toBeInTheDocument();
  });
});