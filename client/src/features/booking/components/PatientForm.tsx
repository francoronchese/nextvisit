import { useState } from "react";
import type { FormEvent } from "react";
import type { PatientFormData } from "../booking.types";
import { useHealthInsurances } from "../hooks/useCatalog";
import { LoadState } from "../../../components/LoadState";

type PatientFormProps = {
  initial?: PatientFormData;
  onSubmit: (data: PatientFormData) => void;
};

type FieldErrors = Partial<Record<keyof PatientFormData, string>>;

function validate(data: PatientFormData): FieldErrors {
  const errors: FieldErrors = {};
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

const inputClass =
  "w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none";

export function PatientForm({ initial, onSubmit }: PatientFormProps) {
  const insurances = useHealthInsurances();
  const [data, setData] = useState<PatientFormData>(
    initial ?? { dni: "", firstName: "", lastName: "", healthInsuranceId: "", phone: "", email: "" }
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const update = (field: keyof PatientFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setData((previous) => ({ ...previous, [field]: event.target.value }));
  };

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
      <div>
        <label htmlFor="patient-dni" className="mb-1 block text-lg text-gray-700">
          DNI
        </label>
        <input
          id="patient-dni"
          inputMode="numeric"
          autoComplete="off"
          value={data.dni}
          onChange={update("dni")}
          aria-invalid={errors.dni ? true : undefined}
          className={inputClass}
        />
        {errors.dni && <p className="mt-1 text-red-700">{errors.dni}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="patient-first-name" className="mb-1 block text-lg text-gray-700">
            First name
          </label>
          <input
            id="patient-first-name"
            autoComplete="given-name"
            value={data.firstName}
            onChange={update("firstName")}
            aria-invalid={errors.firstName ? true : undefined}
            className={inputClass}
          />
          {errors.firstName && <p className="mt-1 text-red-700">{errors.firstName}</p>}
        </div>
        <div>
          <label htmlFor="patient-last-name" className="mb-1 block text-lg text-gray-700">
            Last name
          </label>
          <input
            id="patient-last-name"
            autoComplete="family-name"
            value={data.lastName}
            onChange={update("lastName")}
            aria-invalid={errors.lastName ? true : undefined}
            className={inputClass}
          />
          {errors.lastName && <p className="mt-1 text-red-700">{errors.lastName}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="patient-insurance" className="mb-1 block text-lg text-gray-700">
          Health insurance
        </label>
        <LoadState
          loading={insurances.loading}
          error={insurances.error}
          loadingLabel="Loading health insurances…"
          errorLabel="Couldn't load the health insurances."
          onRetry={insurances.retry}
        >
          <select
            id="patient-insurance"
            value={data.healthInsuranceId}
            onChange={update("healthInsuranceId")}
            aria-invalid={errors.healthInsuranceId ? true : undefined}
            className={`${inputClass} bg-white`}
          >
            <option value="">Choose your insurance…</option>
            {(insurances.data ?? []).map((insurance) => (
              <option key={insurance.id} value={insurance.id}>
                {insurance.name}
              </option>
            ))}
          </select>
        </LoadState>
        {errors.healthInsuranceId && <p className="mt-1 text-red-700">{errors.healthInsuranceId}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="patient-phone" className="mb-1 block text-lg text-gray-700">
            Phone
          </label>
          <input
            id="patient-phone"
            type="tel"
            autoComplete="tel"
            value={data.phone}
            onChange={update("phone")}
            aria-invalid={errors.phone ? true : undefined}
            className={inputClass}
          />
          {errors.phone && <p className="mt-1 text-red-700">{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="patient-email" className="mb-1 block text-lg text-gray-700">
            Email
          </label>
          <input
            id="patient-email"
            type="email"
            autoComplete="email"
            value={data.email}
            onChange={update("email")}
            aria-invalid={errors.email ? true : undefined}
            className={inputClass}
          />
          {errors.email && <p className="mt-1 text-red-700">{errors.email}</p>}
        </div>
      </div>
      <button
        type="submit"
        className="w-full cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800"
      >
        Continue
      </button>
    </form>
  );
}