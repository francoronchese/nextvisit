import { useState } from "react";
import type { FormEvent } from "react";
import type { PatientFormData } from "../booking.types";
import { PatientFields, validatePatientFields, type PatientFieldsErrors } from "./PatientFields";

type PatientFormProps = {
  initial?: PatientFormData;
  onSubmit: (data: PatientFormData) => void;
};

export function PatientForm({ initial, onSubmit }: PatientFormProps) {
  const [data, setData] = useState<PatientFormData>(
    initial ?? { dni: "", firstName: "", lastName: "", healthInsuranceId: "", phone: "", email: "" }
  );
  const [errors, setErrors] = useState<PatientFieldsErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fieldErrors = validatePatientFields(data, { emailRequired: true });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length === 0) {
      onSubmit(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PatientFields
        idPrefix="patient"
        data={data}
        errors={errors}
        onChange={(field, value) => setData((previous) => ({ ...previous, [field]: value }))}
      />
      <button
        type="submit"
        className="w-full cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800"
      >
        Continue
      </button>
    </form>
  );
}