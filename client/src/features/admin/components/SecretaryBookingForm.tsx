import { useEffect, useState } from "react";
import { formatDateLong } from "@nextvisit/shared";
import {
  CatalogSteps,
  StepCard,
  StepIndicator,
  useCatalogSelections,
  type CatalogStep,
} from "../../booking";
import type { AppointmentType, Doctor, SecretaryChannel, SecretaryPatientData, Slot, Specialty } from "../admin.types";
import { useSecretaryBooking } from "../hooks/useSecretaryBooking";
import { SecretaryPatientForm } from "./SecretaryPatientForm";

type SecretaryStep = CatalogStep | "patient" | "confirmation";

const STEP_ORDER: SecretaryStep[] = ["specialty", "type", "doctor", "slot", "patient", "confirmation"];

const STEP_LABELS = ["Specialty", "Appointment type", "Doctor", "Slot", "Patient", "Confirmed"];

const CATALOG_STEPS: CatalogStep[] = ["specialty", "type", "doctor", "slot"];

export function SecretaryBookingForm() {
  const [step, setStep] = useState<SecretaryStep>("specialty");
  const [patient, setPatient] = useState<SecretaryPatientData>();
  const catalog = useCatalogSelections();
  const booking = useSecretaryBooking();
  const { selections, specialties, types, doctors, slots } = catalog;

  // A slot taken by someone else needs a fresh grid, a cleared pick, and a
  // return to the slot step so the secretary can choose another time.
  useEffect(() => {
    if (booking.slotUnavailable) {
      catalog.recoverSlot();
      setStep("slot");
    }
  }, [booking.slotUnavailable]);

  useEffect(() => {
    if (booking.result) {
      setStep("confirmation");
    }
  }, [booking.result]);

  const selectSpecialty = (specialty: Specialty) => {
    catalog.selectSpecialty(specialty);
    setStep("type");
  };

  const selectType = (type: AppointmentType) => {
    catalog.selectType(type);
    setStep("doctor");
  };

  const selectDoctor = (doctor: Doctor) => {
    catalog.selectDoctor(doctor);
    setStep("slot");
  };

  const selectSlot = (slot: Slot) => {
    catalog.selectSlot(slot);
    setStep("patient");
  };

  const confirmBooking = (data: SecretaryPatientData, channel: SecretaryChannel) => {
    if (!selections.doctor || !selections.type || !selections.slot) {
      return;
    }
    setPatient(data);
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

  const goBack = () =>
    setStep((previous) => STEP_ORDER[Math.max(0, STEP_ORDER.indexOf(previous) - 1)]!);

  const startOver = () => {
    setPatient(undefined);
    catalog.reset();
    setStep("specialty");
  };

  if (step === "confirmation" && booking.result && selections.doctor && selections.type && selections.specialty && selections.slot) {
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
          {patient?.email
            ? `A confirmation email was sent to ${patient.email}.`
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
      <StepIndicator labels={STEP_LABELS} current={STEP_ORDER.indexOf(step)} />
      {CATALOG_STEPS.includes(step as CatalogStep) && (
        <CatalogSteps
          step={step as CatalogStep}
          selections={selections}
          specialties={specialties}
          types={types}
          doctors={doctors}
          slots={slots}
          labels={{
            specialty: "Which specialty?",
            type: "Which appointment type?",
            doctor: "Which doctor?",
            slot: "Pick a time",
          }}
          onSelectSpecialty={selectSpecialty}
          onSelectType={selectType}
          onSelectDoctor={selectDoctor}
          onSelectSlot={selectSlot}
          onBack={goBack}
          slotUnavailable={booking.slotUnavailable}
          bookingError={booking.error}
        />
      )}
      {step === "patient" && (
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