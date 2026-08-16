import { useEffect, useState } from "react";
import { ErrorBanner } from "../../../components/ErrorBanner";
import type { AppointmentType, Doctor, PatientFormData, Slot, Specialty } from "../booking.types";
import { useAppointmentTypes, useDoctorsForType, useSpecialties } from "../hooks/useCatalog";
import { useBooking } from "../hooks/useBooking";
import { useSlots } from "../hooks/useSlots";
import { Confirmation } from "./Confirmation";
import { OptionList } from "./OptionList";
import { PatientForm } from "./PatientForm";
import { SlotGrid } from "./SlotGrid";
import { StepCard } from "./StepCard";

type Selections = {
  specialty?: Specialty;
  type?: AppointmentType;
  doctor?: Doctor;
  slot?: Slot;
};

const STEP = {
  PATIENT: 0,
  SPECIALTY: 1,
  TYPE: 2,
  DOCTOR: 3,
  SLOT: 4,
  CONFIRMATION: 5,
} as const;

const STEP_LABELS = ["Your data", "Specialty", "Appointment type", "Doctor", "Slot", "Confirmation"];

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
  const [step, setStep] = useState<number>(STEP.PATIENT);
  const [patient, setPatient] = useState<PatientFormData>();
  const [selections, setSelections] = useState<Selections>({});
  const booking = useBooking();

  const specialties = useSpecialties();
  const types = useAppointmentTypes(selections.specialty?.id);
  const doctors = useDoctorsForType(selections.type?.id);
  const slots = useSlots(selections.doctor?.id, selections.type?.id);

  // A slot that was taken by someone else needs a fresh grid and a cleared pick.
  useEffect(() => {
    if (booking.slotUnavailable) {
      setSelections((previous) => ({ ...previous, slot: undefined }));
      slots.retry();
    }
  }, [booking.slotUnavailable]);

  useEffect(() => {
    if (booking.result) {
      setStep(STEP.CONFIRMATION);
    }
  }, [booking.result]);

  const submitPatient = (data: PatientFormData) => {
    setPatient(data);
    setStep(STEP.SPECIALTY);
  };

  const selectSpecialty = (specialty: Specialty) => {
    setSelections((previous) => {
      if (previous.specialty?.id === specialty.id) {
        return { ...previous, specialty };
      }
      return { specialty };
    });
    setStep(STEP.TYPE);
  };

  const selectType = (type: AppointmentType) => {
    setSelections((previous) => {
      if (previous.type?.id === type.id) {
        return { ...previous, type };
      }
      return { ...previous, type, doctor: undefined, slot: undefined };
    });
    setStep(STEP.DOCTOR);
  };

  const selectDoctor = (doctor: Doctor) => {
    setSelections((previous) => ({ ...previous, doctor, slot: undefined }));
    setStep(STEP.SLOT);
  };

  const selectSlot = (slot: Slot) => {
    setSelections((previous) => ({ ...previous, slot }));
  };

  const confirmBooking = () => {
    if (!patient || !selections.doctor || !selections.type || !selections.slot) {
      return;
    }
    booking.submit({
      ...patient,
      doctorId: selections.doctor.id,
      typeId: selections.type.id,
      date: selections.slot.date,
      startTime: selections.slot.startTime,
    });
  };

  const goBack = () => setStep((previous) => Math.max(STEP.PATIENT, previous - 1));

  const startOver = () => {
    setPatient(undefined);
    setSelections({});
    setStep(STEP.PATIENT);
  };

  if (step === STEP.CONFIRMATION && booking.result && selections.doctor && selections.type && selections.specialty && selections.slot) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <StepIndicator current={step} />
        <Confirmation
          patient={booking.result.patient}
          specialty={selections.specialty}
          type={selections.type}
          doctor={selections.doctor}
          slot={selections.slot}
        />
        <button
          type="button"
          onClick={startOver}
          className="mt-6 w-full cursor-pointer rounded-2xl border-2 border-gray-200 px-4 py-3 text-lg font-medium text-gray-900 hover:border-blue-400"
        >
          Book another appointment
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <StepIndicator current={step} />
      {step === STEP.PATIENT && (
        <StepCard title="Tell us who you are" subtitle="We use your DNI to identify you on every booking.">
          <PatientForm initial={patient} onSubmit={submitPatient} />
        </StepCard>
      )}
      {step === STEP.SPECIALTY && (
        <StepCard title="Which specialty do you need?" onBack={goBack}>
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
      {step === STEP.TYPE && (
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
      {step === STEP.DOCTOR && (
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
        </StepCard>
      )}
      {step === STEP.SLOT && (
        <StepCard
          title="Pick a time for your appointment"
          subtitle={`${selections.doctor?.firstName} ${selections.doctor?.lastName} — ${selections.type?.name}`}
          onBack={goBack}
        >
          <SlotGrid
            slots={slots.data ?? []}
            loading={slots.loading}
            error={slots.error}
            selectedSlot={selections.slot}
            onSelect={selectSlot}
            onRetry={slots.retry}
          />
          {booking.slotUnavailable && (
            <ErrorBanner>{`${booking.error} Please pick another time.`}</ErrorBanner>
          )}
          {!booking.slotUnavailable && booking.error && (
            <ErrorBanner>{booking.error}</ErrorBanner>
          )}
          {selections.slot && (
            <div className="mt-6">
              <p className="text-lg font-medium text-gray-700">
                You chose {selections.slot.date} at {selections.slot.startTime}.
              </p>
              <button
                type="button"
                onClick={confirmBooking}
                disabled={booking.submitting}
                className="mt-4 w-full cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {booking.submitting ? "Confirming…" : "Confirm booking"}
              </button>
            </div>
          )}
        </StepCard>
      )}
    </div>
  );
}