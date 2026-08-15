import type { Slot } from "../booking.types";
import { useResource, type ResourceState } from "./useResource";

// The server anchors the 30-day range to "today" in the clinic timezone, so the
// patient's browser timezone never shifts the first day of the grid.
export function useSlots(
  doctorId: string | undefined,
  typeId: string | undefined
): ResourceState<Slot[]> {
  const path =
    doctorId && typeId ? `/api/doctors/${doctorId}/slots?typeId=${typeId}` : undefined;
  return useResource<Slot[]>(path);
}