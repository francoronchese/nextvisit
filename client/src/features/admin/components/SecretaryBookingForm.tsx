import { useEffect, useState } from "react";
import { formatDateLong } from "@nextvisit/shared";
import { ErrorBanner } from "../../../components/ErrorBanner";
import {
  OptionList,
  SlotGrid,
  StepCard,
  useAppointmentTypes,
  useDoctorsForType,
  useSpecialties,
  useSlots,
} from "../../booking";
import type { AppointmentType, Doctor, SecretaryChannel, Slot, Specialty } from "../admin.types";
import { useAdminBooking } from "../hooks/useAdminBooking";
import { SecretaryPatientForm } from "./SecretaryPatientForm";
import type { SecretaryPatientData } from "../admin.types";

type Selections = {
  specialty?: Specialty;
  type?: AppointmentType;
  doctor?: Doctor;
  slot?: Slot;
};

const STEP = {
  SPECIALTY: 0,
  TYPE: 1,
  DOCTOR: 2,
  SLOT: 3,
  PATIENT: 4,
  CONFIRMATION: 5,
} as const;

const STEP_LABELS = ["Specialty", "Appointment type", "Doctor", "Slot", "Patient", "Confirmed"];

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

export function SecretaryBookingForm() {
  const [step, setStep] = useState<number>(STEP.SPECIALTY);
  const [patient, setPatient] = useState<SecretaryPatientData>();
  const [selections, setSelections] = useState<Selections>({});
  const booking = useAdminBooking();

  const specialties = useSpecialties();
  const types = useAppointmentTypes(selections.specialty?.id);
  const doctors = useDoctorsForType(selections.type?.id);
  const slots = useSlots(selections.doctor?.id, selections.type?.id);

  // A slot taken by someone else needs a fresh grid, a cleared pick, and a
  // return to the slot step so the secretary can choose another time.
  useEffect(() => {
    if (booking.slotUnavailable) {
      setSelections((previous) => ({ ...previous, slot: undefined }));
      setStep(STEP.SLOT);
      slots.retry();
    }
  }, [booking.slotUnavailable]);

  useEffect(() => {
    if (booking.result) {
      setStep(STEP.CONFIRMATION);
    }
  }, [booking.result]);

  const selectSpecialty = (specialty: Specialty) => {
    setSelections((previous) =>
      previous.specialty?.id === specialty.id ? { ...previous, specialty } : { specialty }
    );
    setStep(STEP.TYPE);
  };

  const selectType = (type: AppointmentType) => {
    setSelections((previous) =>
      previous.type?.id === type.id
        ? { ...previous, type }
        : { ...previous, type, doctor: undefined, slot: undefined }
    );
    setStep(STEP.DOCTOR);
  };

  const selectDoctor = (doctor: Doctor) => {
    setSelections((previous) => ({ ...previous, doctor, slot: undefined }));
    setStep(STEP.SLOT);
  };

  const selectSlot = (slot: Slot) => {
    setSelections((previous) => ({ ...previous, slot }));
    setStep(STEP.PATIENT);
  };

  const confirmBooking = (data: SecretaryPatientData, channel: SecretaryChannel) => {
    setPatient(data);
    if (!selections.doctor || !selections.type || !selections.slot) {
      return;
    }
    // An empty email field is sent as absent: the server treats no email as
    // "front-desk/phone patient without one" (CONTEXT.md: Booking Channel).
    booking.submit({
      ...data,
      email: data.email || undefined,
      doctorId: selections.doctor.id,
      typeId: selections.type.id,
      date: selections.slot.date,
      startTime: selections.slot.startTime,
      bookingChannel: channel,
    });
  };

  const goBack = () => setStep((previous) => Math.max(STEP.SPECIALTY, previous - 1));

  const startOver = () => {
    setPatient(undefined);
    setSelections({});
    setStep(STEP.SPECIALTY);
  };

  if (step === STEP.CONFIRMATION && booking.result && selections.doctor && selections.type && selections.specialty && selections.slot) {
    const { patient: bookedPatient, appointment } = booking.result;
    return (
      <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-6">
        <h2 className="text-2xl font-bold text-green-900">Appointment booked</h2>
        <p className="mt-2 text-lg text-gray-700">
          {bookedPatient.firstName} {bookedPatient.lastName} — {selections.doctor.firstName}{" "}
          {selections.doctor.lastName}, {selections.specialty.name} ({selections.type.name})
        </p>
        <p className="mt-4 text-2xl font-semibold text-gray-900">
          {formatDateLong(selections.slot.date)} at {selections.slot.startTime}
        </p>
        <p className="mt-4 text-lg text-gray-700">
          {bookedPatient.email
            ? `A confirmation email was sent to ${bookedPatient.email}.`
            : "No confirmation email was sent because the patient didn't provide one."}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Booking channel: {appointment.bookingChannel === "front_desk" ? "Front desk" : "Phone"}.
        </p>
        <button
          type="button"
          onClick={startOver}
          className="mt-6 w-full cursor-pointer rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-lg font-medium text-gray-900 hover:border-blue-400"
        >
          Book another appointment
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator current={step} />
      {step === STEP.SPECIALTY && (
        <StepCard title="Which specialty?">
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
          title="Which doctor?"
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
          title="Pick a time"
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
        </StepCard>
      )}
      {step === STEP.PATIENT && (
        <StepCard
          title="Patient details"
          subtitle={`${selections.doctor?.firstName} ${selections.doctor?.lastName} — ${selections.slot?.date} at ${selections.slot?.startTime}`}
          onBack={goBack}
        >
          <SecretaryPatientForm
            initial={patient}
            submitting={booking.submitting}
            error={booking.slotUnavailable ? null : booking.error}
            onSubmit={confirmBooking}
          />
        </StepCard>
      )}
    </div>
  );
}
