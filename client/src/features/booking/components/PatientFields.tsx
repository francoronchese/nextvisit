import { LoadState } from "../../../components/LoadState";
import { useHealthInsurances } from "../hooks/useCatalog";

export type PatientFieldsData = {
  dni: string;
  firstName: string;
  lastName: string;
  healthInsuranceId: string;
  phone: string;
  email: string;
};

export type PatientFieldsErrors = Partial<Record<keyof PatientFieldsData, string>>;

type PatientFieldsProps = {
  idPrefix: string;
  data: PatientFieldsData;
  errors: PatientFieldsErrors;
  emailOptional?: boolean;
  phoneLabel?: string;
  onChange: (field: keyof PatientFieldsData, value: string) => void;
};

const inputClass =
  "w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none";

// The public form requires an email; the secretary's booking-on-behalf form
// treats an empty email as "patient without one". Everything else is shared.
export function validatePatientFields(
  data: PatientFieldsData,
  options: { emailRequired: boolean }
): PatientFieldsErrors {
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
  if ((options.emailRequired || data.email.trim()) && !/^\S+@\S+\.\S+$/.test(data.email)) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

// The six patient identity/contact fields shared by the public booking form and
// the secretary's booking-on-behalf form; only email's requiredness and the
// phone label vary between them.
export function PatientFields({
  idPrefix,
  data,
  errors,
  emailOptional,
  phoneLabel = "Phone",
  onChange,
}: PatientFieldsProps) {
  const insurances = useHealthInsurances();
  const update = (field: keyof PatientFieldsData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => onChange(field, event.target.value);

  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-dni`} className="mb-1 block text-lg text-gray-700">
          DNI
        </label>
        <input
          id={`${idPrefix}-dni`}
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
          <label htmlFor={`${idPrefix}-first-name`} className="mb-1 block text-lg text-gray-700">
            First name
          </label>
          <input
            id={`${idPrefix}-first-name`}
            autoComplete="given-name"
            value={data.firstName}
            onChange={update("firstName")}
            aria-invalid={errors.firstName ? true : undefined}
            className={inputClass}
          />
          {errors.firstName && <p className="mt-1 text-red-700">{errors.firstName}</p>}
        </div>
        <div>
          <label htmlFor={`${idPrefix}-last-name`} className="mb-1 block text-lg text-gray-700">
            Last name
          </label>
          <input
            id={`${idPrefix}-last-name`}
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
        <label htmlFor={`${idPrefix}-insurance`} className="mb-1 block text-lg text-gray-700">
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
            id={`${idPrefix}-insurance`}
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
        {errors.healthInsuranceId && (
          <p className="mt-1 text-red-700">{errors.healthInsuranceId}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-phone`} className="mb-1 block text-lg text-gray-700">
            {phoneLabel}
          </label>
          <input
            id={`${idPrefix}-phone`}
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
          <label htmlFor={`${idPrefix}-email`} className="mb-1 block text-lg text-gray-700">
            Email{emailOptional && <span className="text-gray-400"> (optional)</span>}
          </label>
          <input
            id={`${idPrefix}-email`}
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
    </>
  );
}