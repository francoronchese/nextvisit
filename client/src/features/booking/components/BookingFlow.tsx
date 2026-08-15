import { useState } from "react";
import type { AppointmentType, Doctor, Specialty } from "../booking.types";
import { useAppointmentTypes, useDoctorsForType, useSpecialties } from "../hooks/useCatalog";
import { OptionList } from "./OptionList";
import { StepCard } from "./StepCard";

type Selections = {
  specialty?: Specialty;
  type?: AppointmentType;
  doctor?: Doctor;
};

const STEP_LABELS = ["Specialty", "Appointment type", "Doctor"];

function StepIndicator({ current }: { current: number }) {
  return (
    <ol aria-label="Progress" className="mb-8 flex flex-wrap items-center justify-center gap-2">
      {STEP_LABELS.map((label, index) => {
        const state =
          index === current ? "bg-blue-700 text-white" : index < current ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={index === current ? "step" : undefined}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${state}`}
            >
              {index + 1}. {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function BookingFlow() {
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Selections>({});

  const specialties = useSpecialties();
  const types = useAppointmentTypes(selections.specialty?.id);
  const doctors = useDoctorsForType(selections.type?.id);

  const selectSpecialty = (specialty: Specialty) => {
    setSelections((previous) => {
      if (previous.specialty?.id === specialty.id) {
        return { ...previous, specialty };
      }
      return { specialty };
    });
    setStep(1);
  };

  const selectType = (type: AppointmentType) => {
    setSelections((previous) => {
      if (previous.type?.id === type.id) {
        return { ...previous, type };
      }
      return { ...previous, type, doctor: undefined };
    });
    setStep(2);
  };

  const selectDoctor = (doctor: Doctor) => {
    setSelections((previous) => ({ ...previous, doctor }));
  };

  const goBack = () => setStep((previous) => Math.max(0, previous - 1));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <StepIndicator current={step} />
      {step === 0 && (
        <StepCard title="Which specialty do you need?">
          <OptionList
            options={specialties.data ?? []}
            getKey={(specialty) => specialty.id}
            getLabel={(specialty) => specialty.name}
            loading={specialties.loading}
            error={specialties.error}
            emptyLabel="No specialties available."
            selectedId={selections.specialty?.id}
            onSelect={selectSpecialty}
            onRetry={specialties.retry}
          />
        </StepCard>
      )}
      {step === 1 && (
        <StepCard
          title="Which appointment type?"
          subtitle={selections.specialty?.name}
          onBack={goBack}
        >
          <OptionList
            options={types.data ?? []}
            getKey={(type) => type.id}
            getLabel={(type) => `${type.name} (${type.durationMinutes} min)`}
            loading={types.loading}
            error={types.error}
            emptyLabel="No appointment types for this specialty."
            selectedId={selections.type?.id}
            onSelect={selectType}
            onRetry={types.retry}
          />
        </StepCard>
      )}
      {step === 2 && (
        <StepCard
          title="Which doctor would you like to see?"
          subtitle={`${selections.specialty?.name} — ${selections.type?.name}`}
          onBack={goBack}
        >
          <OptionList
            options={doctors.data ?? []}
            getKey={(doctor) => doctor.id}
            getLabel={(doctor) => `${doctor.firstName} ${doctor.lastName}`}
            loading={doctors.loading}
            error={doctors.error}
            emptyLabel="No doctors available for this appointment type."
            selectedId={selections.doctor?.id}
            onSelect={selectDoctor}
            onRetry={doctors.retry}
          />
          {selections.doctor && (
            <p className="mt-6 text-lg font-medium text-gray-700">
              You chose {selections.doctor.firstName} {selections.doctor.lastName}.
            </p>
          )}
        </StepCard>
      )}
    </div>
  );
}