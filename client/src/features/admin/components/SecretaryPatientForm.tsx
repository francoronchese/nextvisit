import { useState } from "react";
import type { FormEvent } from "react";
import { PatientFields, type PatientFieldsErrors } from "../../booking";
import type { SecretaryChannel, SecretaryPatientData } from "../admin.types";

type SecretaryPatientFormProps = {
  initial?: SecretaryPatientData;
  submitting: boolean;
  error: string | null;
  onSubmit: (data: SecretaryPatientData, channel: SecretaryChannel) => void;
};

function validate(data: SecretaryPatientData): PatientFieldsErrors {
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
    errors.healthInsuranceId = "Pick the patient's health insurance.";
  }
  if (!data.phone.trim()) {
    errors.phone = "Phone is required.";
  }
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

const CHANNELS: { value: SecretaryChannel; label: string }[] = [
  { value: "front_desk", label: "Front desk" },
  { value: "phone", label: "Phone" },
];

export function SecretaryPatientForm({ initial, submitting, error, onSubmit }: SecretaryPatientFormProps) {
  const [data, setData] = useState<SecretaryPatientData>(
    initial ?? { dni: "", firstName: "", lastName: "", healthInsuranceId: "", phone: "", email: "" }
  );
  const [channel, setChannel] = useState<SecretaryChannel>("front_desk");
  const [errors, setErrors] = useState<PatientFieldsErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fieldErrors = validate(data);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length === 0) {
      onSubmit(data, channel);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <span className="mb-1 block text-lg text-gray-700">How did the patient book?</span>
        <div className="flex gap-4">
          {CHANNELS.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 text-lg text-gray-900">
              <input
                type="radio"
                name="booking-channel"
                value={option.value}
                checked={channel === option.value}
                onChange={(event) => setChannel(event.target.value as SecretaryChannel)}
                className="h-5 w-5"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
      <PatientFields
        idPrefix="secretary"
        data={data}
        errors={errors}
        emailOptional
        phoneLabel="Phone number"
        onChange={(field, value) => setData((previous) => ({ ...previous, [field]: value }))}
      />
      {error && <div role="alert" className="text-lg text-red-700">{error}</div>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Booking…" : "Book appointment"}
      </button>
    </form>
  );
}