import { useState } from "react";
import type { AppointmentType, Doctor, Slot, Specialty } from "../booking.types";
import { useAppointmentTypes, useDoctorsForType, useSpecialties } from "./useCatalog";
import { useSlots } from "./useSlots";

// The four catalog selections a booking walks through; both the public wizard
// and the secretary booking-on-behalf share it.
export type Selections = {
  specialty?: Specialty;
  type?: AppointmentType;
  doctor?: Doctor;
  slot?: Slot;
};

export function useCatalogSelections() {
  const [selections, setSelections] = useState<Selections>({});

  const specialties = useSpecialties();
  const types = useAppointmentTypes(selections.specialty?.id);
  const doctors = useDoctorsForType(selections.type?.id);
  const slots = useSlots(selections.doctor?.id, selections.type?.id);

  const selectSpecialty = (specialty: Specialty) => {
    setSelections((previous) =>
      previous.specialty?.id === specialty.id ? { ...previous, specialty } : { specialty }
    );
  };

  const selectType = (type: AppointmentType) => {
    setSelections((previous) =>
      previous.type?.id === type.id
        ? { ...previous, type }
        : { ...previous, type, doctor: undefined, slot: undefined }
    );
  };

  const selectDoctor = (doctor: Doctor) => {
    setSelections((previous) => ({ ...previous, doctor, slot: undefined }));
  };

  const selectSlot = (slot: Slot) => {
    setSelections((previous) => ({ ...previous, slot }));
  };

  // A slot that was just taken by someone else: clear the pick and refresh the
  // grid (spec: the loser sees "that slot is no longer available" with the
  // day's grid refreshed).
  const recoverSlot = () => {
    setSelections((previous) => ({ ...previous, slot: undefined }));
    slots.retry();
  };

  const reset = () => setSelections({});

  return {
    selections,
    specialties,
    types,
    doctors,
    slots,
    selectSpecialty,
    selectType,
    selectDoctor,
    selectSlot,
    recoverSlot,
    reset,
  };
}