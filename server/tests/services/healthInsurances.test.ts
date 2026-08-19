import { describe, expect, it, vi } from "vitest";
import type { HealthInsurance } from "@nextvisit/shared";
import {
  createHealthInsurancesService,
  type HealthInsurancesQueries,
} from "../../src/services/healthInsurances";

const osde: HealthInsurance = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  name: "OSDE",
  copayAmount: 12000,
};

const input = { name: "OSDE", copayAmount: 12000 };

function buildQueries(overrides: Partial<HealthInsurancesQueries> = {}) {
  const insertHealthInsurance = vi.fn<HealthInsurancesQueries["insertHealthInsurance"]>((value) =>
    Promise.resolve({ id: osde.id, ...value })
  );
  const updateHealthInsurance = vi.fn<HealthInsurancesQueries["updateHealthInsurance"]>((_id, value) =>
    Promise.resolve({ id: osde.id, ...value })
  );
  const deleteHealthInsurance = vi.fn<HealthInsurancesQueries["deleteHealthInsurance"]>(() =>
    Promise.resolve(true)
  );
  const listHealthInsurances = vi.fn<HealthInsurancesQueries["listHealthInsurances"]>(() =>
    Promise.resolve([osde])
  );
  return {
    queries: {
      insertHealthInsurance,
      updateHealthInsurance,
      deleteHealthInsurance,
      listHealthInsurances,
      ...overrides,
    },
    insertHealthInsurance,
    updateHealthInsurance,
    deleteHealthInsurance,
    listHealthInsurances,
  };
}

describe("health insurances service", () => {
  it("creates a health insurance entry", async () => {
    const { queries, insertHealthInsurance } = buildQueries();
    const service = createHealthInsurancesService(queries);

    await expect(service.createHealthInsurance(input)).resolves.toEqual(osde);
    expect(insertHealthInsurance).toHaveBeenCalledWith(input);
  });

  it("lists all health insurance entries", async () => {
    const { queries, listHealthInsurances } = buildQueries();
    const service = createHealthInsurancesService(queries);

    await expect(service.listHealthInsurances()).resolves.toEqual([osde]);
    expect(listHealthInsurances).toHaveBeenCalledTimes(1);
  });

  it("updates the copay amount of an existing entry", async () => {
    const { queries, updateHealthInsurance } = buildQueries();
    const service = createHealthInsurancesService(queries);

    const updated = { name: "OSDE", copayAmount: 13000 };
    await expect(service.updateHealthInsurance(osde.id, updated)).resolves.toEqual({
      id: osde.id,
      ...updated,
    });
    expect(updateHealthInsurance).toHaveBeenCalledWith(osde.id, updated);
  });

  it("deletes an entry no longer covering anyone", async () => {
    const { queries, deleteHealthInsurance } = buildQueries();
    const service = createHealthInsurancesService(queries);

    await expect(service.deleteHealthInsurance(osde.id)).resolves.toBeUndefined();
    expect(deleteHealthInsurance).toHaveBeenCalledWith(osde.id);
  });

  it("rejects a duplicate name on create as a 409", async () => {
    const { queries } = buildQueries({
      insertHealthInsurance: vi.fn(() => Promise.reject({ code: "23505" })),
    });
    const service = createHealthInsurancesService(queries);

    await expect(service.createHealthInsurance(input)).rejects.toMatchObject({
      status: 409,
      message: "a health insurance with that name already exists",
    });
  });

  it("rejects a duplicate name on update as a 409", async () => {
    const { queries } = buildQueries({
      updateHealthInsurance: vi.fn(() => Promise.reject({ code: "23505" })),
    });
    const service = createHealthInsurancesService(queries);

    await expect(service.updateHealthInsurance(osde.id, input)).rejects.toMatchObject({
      status: 409,
      message: "a health insurance with that name already exists",
    });
  });

  it("rejects updating an unknown entry as a 404", async () => {
    const { queries } = buildQueries({
      updateHealthInsurance: vi.fn(() => Promise.resolve(undefined)),
    });
    const service = createHealthInsurancesService(queries);

    await expect(service.updateHealthInsurance("00000000-0000-0000-0000-000000000000", input)).rejects.toMatchObject(
      { status: 404, message: "health insurance not found" }
    );
  });

  it("rejects deleting an unknown entry as a 404", async () => {
    const { queries } = buildQueries({
      deleteHealthInsurance: vi.fn(() => Promise.resolve(false)),
    });
    const service = createHealthInsurancesService(queries);

    await expect(
      service.deleteHealthInsurance("00000000-0000-0000-0000-000000000000")
    ).rejects.toMatchObject({ status: 404, message: "health insurance not found" });
  });

  it("rejects deleting an entry still covering patients as a 409", async () => {
    const { queries } = buildQueries({
      deleteHealthInsurance: vi.fn(() => Promise.reject({ code: "23503" })),
    });
    const service = createHealthInsurancesService(queries);

    await expect(service.deleteHealthInsurance(osde.id)).rejects.toMatchObject({
      status: 409,
      message: "a health insurance that still covers patients cannot be deleted",
    });
  });

  it("stores the name trimmed so the unique index never sees stray spaces", async () => {
    const { queries, insertHealthInsurance } = buildQueries();
    const service = createHealthInsurancesService(queries);

    await service.createHealthInsurance({ name: "  OSDE  ", copayAmount: 12000 });

    expect(insertHealthInsurance).toHaveBeenCalledWith({ name: "OSDE", copayAmount: 12000 });
  });
});
