import { APPROVAL_LABELS } from "@/lib/shared/attendance-review";
import ExcelJS from "exceljs";
import { formatInTimeZone } from "date-fns-tz";
import {
  exportHistoryRows,
  parseFilters,
} from "@/features/attendance-history/queries";
import { requirePermission } from "@/lib/server/auth/permissions";
import { ABSENCE_LABELS } from "@/features/absences/labels";
import { recordActivity } from "@/features/activity-logs/server";
import { db } from "@/lib/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clockDate(value, zone) {
  if (!value) return null;
  return new Date(
    formatInTimeZone(new Date(value), zone, "yyyy-MM-dd'T'HH:mm:ss") + "Z",
  );
}
function styleSheet(sheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount },
  };
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF493628" },
  };
  header.height = 28;
  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
}
export async function GET(request) {
  const actor = await requirePermission("history", "read");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  let filters;
  try {
    filters = parseFilters(params);
  } catch {
    return new Response(
      "Filter ekspor tidak valid. Gunakan rentang maksimal 366 hari.",
      { status: 400 },
    );
  }
  const { rows } = await exportHistoryRows(filters);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PT Composite Interior Prima";
  const sheet = workbook.addWorksheet(
    filters.view === "recap" ? "Rekap Pengguna" : "Riwayat Absensi",
  );
  if (filters.view === "recap") {
    sheet.columns = [
      { header: "Kode User", key: "code", width: 18 },
      { header: "Nama", key: "name", width: 28 },
      { header: "Role saat pencatatan", key: "role", width: 24 },
      { header: "Hari Hadir", key: "days", width: 14 },
      { header: "Sakit", key: "sick", width: 12 },
      { header: "Izin", key: "leave", width: 12 },
      { header: "Tanpa Keterangan", key: "unexcused", width: 20 },
      { header: "Hari Terlambat", key: "late", width: 18 },
      {
        header: "Total Terlambat",
        key: "lateTime",
        width: 20,
        style: { numFmt: "[h]:mm:ss" },
      },
      { header: "Pulang Lebih Awal", key: "early", width: 20 },
      { header: "Belum Pulang", key: "open", width: 16 },
      {
        header: "Durasi Kehadiran",
        key: "duration",
        width: 20,
        style: { numFmt: "[h]:mm:ss" },
      },
    ];
    const groups = new Map();
    for (const row of rows) {
      const key = `${row.groupKey}:${row.userId}`;
      if (!groups.has(key))
        groups.set(key, {
          code: row.code,
          name: row.name,
          role: row.groupLabel,
          dates: new Set(),
          lateDates: new Set(),
          sick: 0,
          leave: 0,
          unexcused: 0,
          early: 0,
          open: 0,
          lateTime: 0,
          duration: 0,
        });
      const group = groups.get(key);
      if (row.absenceStatus) group[row.absenceStatus]++;
      else if (row.approvalStatus !== "rejected") {
        group.dates.add(row.date);
        if (row.lateSeconds > 0) group.lateDates.add(row.date);
        group.lateTime += Number(row.lateSeconds) / 86400;
        if (row.earlySeconds > 0) group.early++;
        if (!row.checkOut) group.open++;
        else
          group.duration +=
            (new Date(row.checkOut) - new Date(row.checkIn)) / 86400000;
      }
    }
    for (const group of groups.values())
      sheet.addRow({
        ...group,
        days: group.dates.size,
        late: group.lateDates.size,
      });
  } else {
    sheet.columns = [
      {
        header: "Tanggal Kerja",
        key: "date",
        width: 16,
        style: { numFmt: "dd/mm/yyyy" },
      },
      { header: "Kode User", key: "code", width: 18 },
      { header: "Nama", key: "name", width: 28 },
      { header: "Username", key: "username", width: 24 },
      { header: "Role saat pencatatan", key: "role", width: 24 },
      { header: "Jenis Pekerja", key: "employee", width: 18 },
      { header: "Status", key: "status", width: 22 },
      { header: "Jenis Pekerjaan", key: "workType", width: 20 },
      { header: "Project", key: "project", width: 28 },
      {
        header: "Absen Masuk",
        key: "checkIn",
        width: 23,
        style: { numFmt: "dd/mm/yyyy hh:mm" },
      },
      {
        header: "Absen Pulang",
        key: "checkOut",
        width: 23,
        style: { numFmt: "dd/mm/yyyy hh:mm" },
      },
      { header: "Approval", key: "approval", width: 20 },
      { header: "Alasan penolakan", key: "approvalReason", width: 40 },
      { header: "Project laporan", key: "reportedProject", width: 28 },
      { header: "Jadwal", key: "schedule", width: 24 },
      { header: "Zona Waktu", key: "zone", width: 20 },
      {
        header: "Masuk Terjadwal",
        key: "start",
        width: 23,
        style: { numFmt: "dd/mm/yyyy hh:mm" },
      },
      {
        header: "Pulang Terjadwal",
        key: "end",
        width: 23,
        style: { numFmt: "dd/mm/yyyy hh:mm" },
      },
      {
        header: "Keterlambatan",
        key: "late",
        width: 18,
        style: { numFmt: "[h]:mm:ss" },
      },
      {
        header: "Pulang Lebih Awal",
        key: "early",
        width: 22,
        style: { numFmt: "[h]:mm:ss" },
      },
      {
        header: "Durasi Kehadiran",
        key: "duration",
        width: 22,
        style: { numFmt: "[h]:mm:ss" },
      },
      { header: "Alasan Pulang Awal", key: "earlyReason", width: 28 },
      { header: "Keterangan Pulang Awal", key: "earlyNote", width: 40 },
      { header: "Keterangan Operasional", key: "workNote", width: 50 },
      { header: "Catatan Ketidakhadiran", key: "note", width: 50 },
    ];
    for (const row of rows)
      sheet.addRow({
        date: new Date(row.date + "T00:00:00Z"),
        code: row.code,
        name: row.name,
        approval: APPROVAL_LABELS[row.approvalStatus] || "",
        approvalReason: row.approvalReason || "",
        reportedProject: row.reportedProject || "",
        username: row.username,
        role: row.groupLabel,
        employee:
          row.employeeType === "tukang"
            ? "Tukang"
            : row.employeeType === "karyawan"
              ? "Karyawan"
              : null,
        status: row.absenceStatus
          ? ABSENCE_LABELS[row.absenceStatus]
          : row.approvalStatus === "rejected"
            ? "Ditolak"
            : "Hadir",
        workType:
          row.workType === "operational"
            ? "Operasional"
            : row.workType === "project" || row.project
              ? "Project"
              : null,
        project: row.project,
        checkIn: clockDate(row.checkIn, row.timezone),
        checkOut: clockDate(row.checkOut, row.timezone),
        schedule: row.scheduleName,
        zone: row.timezone,
        start: clockDate(row.scheduledStart, row.timezone),
        end: clockDate(row.scheduledEnd, row.timezone),
        late: row.absenceStatus ? null : Number(row.lateSeconds) / 86400,
        early: row.absenceStatus ? null : Number(row.earlySeconds) / 86400,
        duration: row.checkOut
          ? (new Date(row.checkOut) - new Date(row.checkIn)) / 86400000
          : null,
        earlyReason: row.earlyReason,
        earlyNote: row.earlyReasonText,
        workNote: row.workNote,
        note: row.note,
      });
  }
  styleSheet(sheet);
  sheet.eachRow((row, index) => {
    if (index <= 1) return;
    const key = filters.view === "recap" ? "lateTime" : "late";
    const cell = row.getCell(key);
    if (Number(cell.value) > 0)
      cell.font = { ...cell.font, color: { argb: "FFB42318" } };
  });
  const buffer = await workbook.xlsx.writeBuffer();
  await recordActivity(
    db,
    actor,
    "history",
    "export",
    `${filters.from}–${filters.to} · ${rows.length} catatan diekspor`,
  );
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="absensi-${filters.from}-${filters.to}.xlsx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
