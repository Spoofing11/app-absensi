export const APPROVAL_LABELS = {
  legacy: "Data sebelumnya",
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};
export function countsAsPresent(row) {
  return !!(row.checkInAt || row.checkIn) && row.approvalStatus !== "rejected";
}
export function missingCheckout(row, today) {
  return !(row.checkOutAt || row.checkOut) && row.workDate < today;
}
