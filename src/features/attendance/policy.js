export const EARLY_REASONS = [
  "Sakit",
  "Keperluan pribadi",
  "Izin atasan",
  "Lainnya",
];
export function durationLabel(seconds) {
  const minutes = Math.ceil(Math.max(0, seconds) / 60);
  if (!minutes) return "0 menit";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours} jam` : "", remainder ? `${remainder} menit` : ""]
    .filter(Boolean)
    .join(" ");
}
export function checkoutPolicy(scheduledEndAt, now, reason = {}) {
  const earlySeconds = Math.max(
    0,
    Math.ceil((new Date(scheduledEndAt) - now) / 1000),
  );
  if (!earlySeconds)
    return {
      earlySeconds: 0,
      earlyReasonCategory: null,
      earlyReasonText: null,
    };
  const text = typeof reason?.text === "string" ? reason.text.trim() : "";
  if (
    !EARLY_REASONS.includes(reason?.category) ||
    text.length < 5 ||
    text.length > 1000
  )
    throw new Error(
      "Pulang lebih awal wajib memilih alasan dan mengisi keterangan 5–1000 karakter.",
    );
  return {
    earlySeconds,
    earlyReasonCategory: reason.category,
    earlyReasonText: text,
  };
}
