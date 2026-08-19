import { describe, expect, it, vi } from "vitest";
import { createNoShowService } from "../../src/services/noShows";
import type { NoShowCandidate, NoShowQueries } from "../../src/db/queries/noShows";

const NOW = new Date("2026-11-20T10:00:00.000Z");

const overdue: NoShowCandidate = { appointmentId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18" };
const secondOverdue: NoShowCandidate = { appointmentId: "d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a1b" };

function buildQueries(overrides: Partial<NoShowQueries> = {}): NoShowQueries {
  return {
    listOverdue: vi.fn(() => Promise.resolve([overdue])),
    markNoShow: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  };
}

function buildService(queries: NoShowQueries = buildQueries()) {
  return createNoShowService({ queries });
}

describe("no-show service", () => {
  it("marks every overdue scheduled appointment as no-show and reports the count", async () => {
    const queries = buildQueries({
      listOverdue: vi.fn(() => Promise.resolve([overdue, secondOverdue])),
    });
    const service = buildService(queries);

    const result = await service.markOverdue({ now: NOW });

    expect(queries.listOverdue).toHaveBeenCalledWith(NOW);
    expect(result).toEqual({ noShowsMarked: 2 });
    expect(queries.markNoShow).toHaveBeenCalledWith(overdue.appointmentId, NOW);
    expect(queries.markNoShow).toHaveBeenCalledWith(secondOverdue.appointmentId, NOW);
  });

  it("marks nothing when no appointment has started yet", async () => {
    const queries = buildQueries({ listOverdue: vi.fn(() => Promise.resolve([])) });
    const service = buildService(queries);

    await expect(service.markOverdue({ now: NOW })).resolves.toEqual({ noShowsMarked: 0 });
    expect(queries.markNoShow).not.toHaveBeenCalled();
  });

  it("does not count appointments already ended or cancelled between list and write", async () => {
    const queries = buildQueries({
      listOverdue: vi.fn(() => Promise.resolve([overdue, secondOverdue])),
      markNoShow: vi.fn((id: string) => Promise.resolve(id === overdue.appointmentId)),
    });
    const service = buildService(queries);

    const result = await service.markOverdue({ now: NOW });

    expect(result).toEqual({ noShowsMarked: 1 });
    expect(queries.markNoShow).toHaveBeenCalledTimes(2);
  });
});