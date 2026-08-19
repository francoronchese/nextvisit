import type { HealthInsurance } from "@nextvisit/shared";
import {
  deleteHealthInsurance,
  insertHealthInsurance,
  listHealthInsurances,
  type HealthInsuranceInput,
  updateHealthInsurance,
} from "../db/queries/healthInsurances";
import {
  insuranceInUseError,
  insuranceNameTakenError,
  notFoundError,
} from "../utils/httpErrors";
import { isConstraintViolation, isForeignKeyViolation } from "../utils/isConstraintViolation";

export type HealthInsurancesQueries = {
  listHealthInsurances(): Promise<HealthInsurance[]>;
  insertHealthInsurance(input: HealthInsuranceInput): Promise<HealthInsurance>;
  updateHealthInsurance(
    id: string,
    input: HealthInsuranceInput
  ): Promise<HealthInsurance | undefined>;
  deleteHealthInsurance(id: string): Promise<boolean>;
};

export type HealthInsurancesService = {
  listHealthInsurances(): Promise<HealthInsurance[]>;
  createHealthInsurance(input: HealthInsuranceInput): Promise<HealthInsurance>;
  updateHealthInsurance(id: string, input: HealthInsuranceInput): Promise<HealthInsurance>;
  deleteHealthInsurance(id: string): Promise<void>;
};

export function createHealthInsurancesService(
  queries: HealthInsurancesQueries
): HealthInsurancesService {
  // Stored trimmed so the DB unique index on name never sees stray spaces.
  const normalize = (input: HealthInsuranceInput): HealthInsuranceInput => ({
    name: input.name.trim(),
    copayAmount: input.copayAmount,
  });

  return {
    listHealthInsurances() {
      return queries.listHealthInsurances();
    },

    async createHealthInsurance(input) {
      try {
        return await queries.insertHealthInsurance(normalize(input));
      } catch (error) {
        // The DB unique index on health_insurances.name is the authority: the
        // rejection holds even when two admins race to create the same entry.
        if (isConstraintViolation(error)) {
          throw insuranceNameTakenError();
        }
        throw error;
      }
    },

    async updateHealthInsurance(id, input) {
      try {
        const updated = await queries.updateHealthInsurance(id, normalize(input));
        if (!updated) {
          throw notFoundError("health insurance");
        }
        return updated;
      } catch (error) {
        if (isConstraintViolation(error)) {
          throw insuranceNameTakenError();
        }
        throw error;
      }
    },

    async deleteHealthInsurance(id) {
      try {
        const deleted = await queries.deleteHealthInsurance(id);
        if (!deleted) {
          throw notFoundError("health insurance");
        }
      } catch (error) {
        // Deleting an insurance still covering patients violates the FK on
        // patients.health_insurance_id; surface it as a domain conflict.
        if (isForeignKeyViolation(error)) {
          throw insuranceInUseError();
        }
        throw error;
      }
    },
  };
}

export const healthInsurancesService = createHealthInsurancesService({
  listHealthInsurances,
  insertHealthInsurance,
  updateHealthInsurance,
  deleteHealthInsurance,
});
