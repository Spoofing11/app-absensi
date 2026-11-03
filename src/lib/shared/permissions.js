export const FEATURES = {
  history: "Riwayat Absensi",
  schedules: "Jadwal Kerja",
  users: "Manajemen User",
  roles: "Manajemen Role",
  projects: "Manajemen Project",
  assignments: "Penempatan Tukang",
};
export const OPERATIONS = ["create", "read", "edit", "delete"];
export function allowed(permissions, feature, operation) {
  return permissions?.[feature]?.[operation] === true;
}
