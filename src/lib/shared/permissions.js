export const FEATURES = {
  absences: "Ketidakhadiran",
  history: "Riwayat Absensi",
  schedules: "Jadwal Kerja",
  users: "Manajemen User",
  roles: "Manajemen Role",
  projects: "Manajemen Project",
  assignments: "Penempatan Project",
  approvals: "Approval Absensi",
  "photo-recap": "Rekap Foto Absensi",
};
export const OPERATIONS = ["create", "read", "edit", "delete"];
export function allowed(permissions, feature, operation) {
  return permissions?.[feature]?.[operation] === true;
}

export function supportsOperation(feature, operation) {
  if (["history", "photo-recap"].includes(feature)) return operation === "read";
  if (feature === "approvals") return ["read", "edit"].includes(operation);
  return true;
}
