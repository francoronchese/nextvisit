import { z } from "zod";
import { appointmentDetailSchema } from "./appointmentDetail";
import { healthInsuranceSchema } from "./healthInsurance";

// The secretary attendance list carries each appointment's patient insurance so
// the copay field can be pre-filled from the health_insurances table (spec:
// secretary only confirms the amount). Built from the patient-flow detail plus
// the insurance it covers.
export const appointmentDetailWithInsuranceSchema = appointmentDetailSchema.extend({
  insurance: healthInsuranceSchema,
});

export type AppointmentDetailWithInsurance = z.infer<
  typeof appointmentDetailWithInsuranceSchema
>;