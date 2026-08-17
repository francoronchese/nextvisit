export { BookingFlow } from "./components/BookingFlow";
export { Confirmation } from "./components/Confirmation";
export { PatientForm } from "./components/PatientForm";
export { SlotGrid } from "./components/SlotGrid";
export { useAppointmentTypes, useDoctorsForType, useHealthInsurances, useSpecialties } from "./hooks/useCatalog";
export { useBooking } from "./hooks/useBooking";
export { useSlots } from "./hooks/useSlots";
export type {
  BookingPayload,
  BookingResult,
  PatientFormData,
} from "./booking.types";