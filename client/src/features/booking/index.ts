export { BookingFlow } from "./components/BookingFlow";
export { Confirmation } from "./components/Confirmation";
export { OptionList } from "./components/OptionList";
export { PatientFields } from "./components/PatientFields";
export { PatientForm } from "./components/PatientForm";
export { SlotGrid } from "./components/SlotGrid";
export { StepCard } from "./components/StepCard";
export type { PatientFieldsErrors } from "./components/PatientFields";
export { validatePatientFields } from "./components/PatientFields";
export { useAppointmentTypes, useDoctorsForType, useHealthInsurances, useSpecialties } from "./hooks/useCatalog";
export { useBooking } from "./hooks/useBooking";
export { useSlots } from "./hooks/useSlots";
export type {
  BookingPayload,
  BookingResult,
  PatientFormData,
} from "./booking.types";