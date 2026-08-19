import type { HealthInsurance } from "@nextvisit/shared";
import { query, queryOne, requireRow } from "../client";

export const HEALTH_INSURANCE_COLUMNS = `id, name, copay_amount::float8 AS "copayAmount"`;

export type HealthInsuranceInput = {
  name: string;
  copayAmount: number;
};

export async function listHealthInsurances(): Promise<HealthInsurance[]> {
  return query<HealthInsurance>(
    `SELECT ${HEALTH_INSURANCE_COLUMNS}
     FROM health_insurances
     ORDER BY name`
  );
}

export async function insertHealthInsurance(input: HealthInsuranceInput): Promise<HealthInsurance> {
  return requireRow(
    await queryOne<HealthInsurance>(
      `INSERT INTO health_insurances (name, copay_amount)
       VALUES ($1, $2)
       RETURNING ${HEALTH_INSURANCE_COLUMNS}`,
      [input.name, input.copayAmount]
    ),
    "create health insurance"
  );
}

export async function updateHealthInsurance(
  id: string,
  input: HealthInsuranceInput
): Promise<HealthInsurance | undefined> {
  return queryOne<HealthInsurance>(
    `UPDATE health_insurances
     SET name = $2, copay_amount = $3
     WHERE id = $1
     RETURNING ${HEALTH_INSURANCE_COLUMNS}`,
    [id, input.name, input.copayAmount]
  );
}

export async function deleteHealthInsurance(id: string): Promise<boolean> {
  const result = await query<{ deleted: number }>(
    `DELETE FROM health_insurances WHERE id = $1 RETURNING 1 AS deleted`,
    [id]
  );
  return result.length > 0;
}
