import type { ReactNode } from "react";
import { ErrorBanner } from "../../../components/ErrorBanner";
import type { ResourceState } from "../../../hooks/useResource";
import type { AppointmentType, Doctor, Slot, Specialty } from "../booking.types";
import type { Selections } from "../hooks/useCatalogSelections";
import { OptionList } from "./OptionList";
import { SlotGrid } from "./SlotGrid";
import { StepCard } from "./StepCard";

export type CatalogStep = "specialty" | "type" | "doctor" | "slot";

type CatalogLabels = {
  specialty: string;
  type: string;
  doctor: string;
  slot: string;
};

type CatalogStepsProps = {
  step: CatalogStep;
  selections: Selections;
  specialties: ResourceState<Specialty[]>;
  types: ResourceState<AppointmentType[]>;
  doctors: ResourceState<Doctor[]>;
  slots: ResourceState<Slot[]>;
  labels: CatalogLabels;
  onSelectSpecialty: (specialty: Specialty) => void;
  onSelectType: (type: AppointmentType) => void;
  onSelectDoctor: (doctor: Doctor) => void;
  onSelectSlot: (slot: Slot) => void;
  onBack: () => void;
  onBackSpecialty?: () => void;
  slotUnavailable: boolean;
  bookingError: string | null;
  slotFooter?: ReactNode;
};

// The four catalog browsing steps shared by the public wizard and the
// secretary's booking-on-behalf form (specialty → type → doctor → slot). The
// flows differ only in wording, in when the patient step runs, and in what sits
// under the slot grid.
export function CatalogSteps({
  step,
  selections,
  specialties,
  types,
  doctors,
  slots,
  labels,
  onSelectSpecialty,
  onSelectType,
  onSelectDoctor,
  onSelectSlot,
  onBack,
  onBackSpecialty,
  slotUnavailable,
  bookingError,
  slotFooter,
}: CatalogStepsProps) {
  if (step === "specialty") {
    return (
      <StepCard title={labels.specialty} onBack={onBackSpecialty}>
        <OptionList
          options={specialties.data ?? []}
          getKey={(specialty) => specialty.id}
          getLabel={(specialty) => specialty.name}
          loading={specialties.loading}
          error={specialties.error}
          emptyLabel="No specialties available."
          selectedId={selections.specialty?.id}
          onSelect={onSelectSpecialty}
          onRetry={specialties.retry}
        />
      </StepCard>
    );
  }

  if (step === "type") {
    return (
      <StepCard title={labels.type} subtitle={selections.specialty?.name} onBack={onBack}>
        <OptionList
          options={types.data ?? []}
          getKey={(type) => type.id}
          getLabel={(type) => `${type.name} (${type.durationMinutes} min)`}
          loading={types.loading}
          error={types.error}
          emptyLabel="No appointment types for this specialty."
          selectedId={selections.type?.id}
          onSelect={onSelectType}
          onRetry={types.retry}
        />
      </StepCard>
    );
  }

  if (step === "doctor") {
    return (
      <StepCard
        title={labels.doctor}
        subtitle={`${selections.specialty?.name} — ${selections.type?.name}`}
        onBack={onBack}
      >
        <OptionList
          options={doctors.data ?? []}
          getKey={(doctor) => doctor.id}
          getLabel={(doctor) => `${doctor.firstName} ${doctor.lastName}`}
          loading={doctors.loading}
          error={doctors.error}
          emptyLabel="No doctors available for this appointment type."
          selectedId={selections.doctor?.id}
          onSelect={onSelectDoctor}
          onRetry={doctors.retry}
        />
      </StepCard>
    );
  }

  return (
    <StepCard
      title={labels.slot}
      subtitle={`${selections.doctor?.firstName} ${selections.doctor?.lastName} — ${selections.type?.name}`}
      onBack={onBack}
    >
      <SlotGrid
        slots={slots.data ?? []}
        loading={slots.loading}
        error={slots.error}
        selectedSlot={selections.slot}
        onSelect={onSelectSlot}
        onRetry={slots.retry}
      />
      {slotUnavailable && (
        <ErrorBanner>{`${bookingError} Please pick another time.`}</ErrorBanner>
      )}
      {!slotUnavailable && bookingError && <ErrorBanner>{bookingError}</ErrorBanner>}
      {slotFooter}
    </StepCard>
  );
}