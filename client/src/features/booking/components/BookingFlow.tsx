import { useEffect, useState } from "react";
import type { AppointmentType, Doctor, PatientFormData, Specialty } from "../booking.types";
import type { CatalogStep } from "./CatalogSteps";
import { CatalogSteps } from "./CatalogSteps";
import { useCatalogSelections } from "../hooks/useCatalogSelections";
import { useBooking } from "../hooks/useBooking";
import { Confirmation } from "./Confirmation";
import { PatientForm } from "./PatientForm";
import { StepCard } from "./StepCard";
import { StepIndicator } from "./StepIndicator";

const STEP = {
  PATIENT: 0,
  SPECIALTY: 1,
  TYPE: 2,
  DOCTOR: 3,
  SLOT: 4,
  CONFIRMATION: 5,
} as const;

const STEP_LABELS = ["Your data", "Specialty", "Appointment type", "Doctor", "Slot", "Confirmation"];

const CATALOG_STEP = {
  [STEP.SPECIALTY]: "specialty",
  [STEP.TYPE]: "type",
  [STEP.DOCTOR]: "doctor",
  [STEP.SLOT]: "slot",
} as const;
export function BookingFlow() {
  const [step, setStep] = useState<number>(STEP.PATIENT);
  const [patient, setPatient] = useState<PatientFormData>();
  const catalog = useCatalogSelections();
  const booking = useBooking();
  const { selections, specialties, types, doctors, slots } = catalog;

  // A slot that was taken by someone else needs a fresh grid and a cleared pick.
  useEffect(() => {
    if (booking.slotUnavailable) {
      catalog.recoverSlot();
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
    catalog.selectSpecialty(specialty);
    setStep(STEP.TYPE);
  };

  const selectType = (type: AppointmentType) => {
    catalog.selectType(type);
    setStep(STEP.DOCTOR);
  };

  const selectDoctor = (doctor: Doctor) => {
    catalog.selectDoctor(doctor);
    setStep(STEP.SLOT);
  };

  const selectSlot = catalog.selectSlot;

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
    catalog.reset();
    setStep(STEP.PATIENT);
  };

  if (step === STEP.CONFIRMATION && booking.result && selections.doctor && selections.type && selections.specialty && selections.slot) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <StepIndicator labels={STEP_LABELS} current={step} />
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
      <StepIndicator labels={STEP_LABELS} current={step} />
      {step === STEP.PATIENT && (
        <StepCard title="Tell us who you are" subtitle="We use your DNI to identify you on every booking.">
          <PatientForm initial={patient} onSubmit={submitPatient} />
        </StepCard>
      )}
      {(step === STEP.SPECIALTY || step === STEP.TYPE || step === STEP.DOCTOR || step === STEP.SLOT) && (
        <CatalogSteps
          step={CATALOG_STEP[step]}
          selections={selections}
          specialties={specialties}
          types={types}
          doctors={doctors}
          slots={slots}
          labels={{
            specialty: "Which specialty do you need?",
            type: "Which appointment type?",
            doctor: "Which doctor would you like to see?",
            slot: "Pick a time for your appointment",
          }}
          onSelectSpecialty={selectSpecialty}
          onSelectType={selectType}
          onSelectDoctor={selectDoctor}
          onSelectSlot={selectSlot}
          onBack={goBack}
          onBackSpecialty={goBack}
          slotUnavailable={booking.slotUnavailable}
          bookingError={booking.error}
          slotFooter={
            selections.slot && (
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
            )
          }
        />
      )}
    </div>
  );
}