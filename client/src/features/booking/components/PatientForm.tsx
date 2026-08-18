import { useState } from "react";
import type { FormEvent } from "react";
import type { PatientFormData } from "../booking.types";
import { PatientFields, type PatientFieldsErrors } from "./PatientFields";

type PatientFormProps = {
  initial?: PatientFormData;
  onSubmit: (data: PatientFormData) => void;
};

function validate(data: PatientFormData): PatientFieldsErrors {
  const errors: PatientFieldsErrors = {};
  if (!/^\d{7,8}$/.test(data.dni)) {
    errors.dni = "DNI must be 7 to 8 digits.";
  }
  if (!data.firstName.trim()) {
    errors.firstName = "First name is required.";
  }
  if (!data.lastName.trim()) {
    errors.lastName = "Last name is required.";
  }
  if (!data.healthInsuranceId) {
    errors.healthInsuranceId = "Pick your health insurance.";
  }
  if (!data.phone.trim()) {
    errors.phone = "Phone is required.";
  }
  if (!/^\S+@\S+\.\S+$/.test(data.email)) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

export function PatientForm({ initial, onSubmit }: PatientFormProps) {
  const [data, setData] = useState<PatientFormData>(
    initial ?? { dni: "", firstName: "", lastName: "", healthInsuranceId: "", phone: "", email: "" }
  );
  const [errors, setErrors] = useState<PatientFieldsErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fieldErrors = validate(data);
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