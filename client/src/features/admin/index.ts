export { AdminLoginPage } from "./pages/AdminLoginPage";
export { AvailabilityManager } from "./components/AvailabilityManager";
export { BlockSection } from "./components/BlockSection";
export { SecretaryBookingForm } from "./components/SecretaryBookingForm";
export { SecretaryDashboard } from "./components/SecretaryDashboard";
export { WeeklyAvailabilitySection } from "./components/WeeklyAvailabilitySection";
export { useAdminBooking } from "./hooks/useAdminBooking";
export { useAdminDoctors } from "./hooks/useAdminDoctors";
export { useAvailability } from "./hooks/useAvailability";
export { useAvailabilityBlocks } from "./hooks/useAvailabilityBlocks";
export type {
  AvailabilityBlockInput,
  AvailabilityInput,
  SecretaryBookingPayload,
  SecretaryBookingResult,
  SecretaryPatientData,
} from "./admin.types";