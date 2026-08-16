export const END_TIME_AFTER_START_ERROR = "End time must be after start time.";

type TimeRangeFieldsProps = {
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
};

export function TimeRangeFields({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
}: TimeRangeFieldsProps) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-lg text-gray-700">Start</span>
        <input
          type="time"
          value={startTime}
          onChange={(event) => onStartTimeChange(event.target.value)}
          className="rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-lg text-gray-700">End</span>
        <input
          type="time"
          value={endTime}
          onChange={(event) => onEndTimeChange(event.target.value)}
          className="rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
        />
      </label>
    </>
  );
}