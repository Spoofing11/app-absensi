export function canUseAttendance(user) {
  return (
    !!user?.isActive &&
    user.attendanceEnabled === true &&
    ["karyawan", "tukang"].includes(user.employeeType)
  );
}
