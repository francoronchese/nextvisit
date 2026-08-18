export { AdminLoginPage } from "./pages/AdminLoginPage";
export { AttendanceForm } from "./components/AttendanceForm";
export { AttendanceManager } from "./components/AttendanceManager";
export { AvailabilityManager } from "./components/AvailabilityManager";
export { BlockSection } from "./components/BlockSection";
export { SecretaryBookingForm } from "./components/SecretaryBookingForm";
export { SecretaryDashboard } from "./components/SecretaryDashboard";
export { WeeklyAvailabilitySection } from "./components/WeeklyAvailabilitySection";
export { useSecretaryBooking } from "./hooks/useSecretaryBooking";
export { useAdminDoctors } from "./hooks/useAdminDoctors";
export { useAvailability } from "./hooks/useAvailability";
export { useAvailabilityBlocks } from "./hooks/useAvailabilityBlocks";
export { useDayAppointments } from "./hooks/useDayAppointments";
export { useRecordAttendance } from "./hooks/useRecordAttendance";
export type {
  AvailabilityBlockInput,
  AvailabilityInput,
  SecretaryBookingPayload,
  SecretaryBookingResult,
  SecretaryPatientData,
} from "./admin.types";