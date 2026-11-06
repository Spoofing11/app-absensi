"use server";
import { recordActivity } from "@/features/activity-logs/server";
import { randomUUID } from "node:crypto";
import { storePhoto, deletePhoto } from "@/lib/server/photo-storage";
import sharp from "sharp";
import { and, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/server/db";
import {
  users,
  attendances,
  mediaFiles,
  roles,
  absences,
  projects,
} from "@/lib/server/db/schema";
import { requireAttendanceUser } from "@/lib/server/auth/attendance";
import { canUseAttendance } from "@/lib/shared/attendance-access";
import { checkoutPolicy } from "./policy";
import { currentAttendance } from "./queries";
import { attendanceTiming } from "@/features/schedules/timing";
import { resolveWorkSchedule } from "@/features/schedules/resolver";
import { env } from "@/lib/server/env";

function today() {
  return formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
}

function summary(row) {
  return row
    ? {
        lateSeconds: row.lateSeconds,
        scheduledEndAt: row.scheduledEndAt.toISOString(),
        earlySeconds: row.earlySeconds,
        earlyReasonCategory: row.earlyReasonCategory,
        earlyReasonText: row.earlyReasonText,
        check_in_time: row.checkInAt?.toISOString(),
        check_out_time: row.checkOutAt?.toISOString(),
        check_in_photo: !!row.checkInPhotoId,
        check_out_photo: !!row.checkOutPhotoId,
      }
    : null;
}

export async function attendanceContext() {
  const user = await requireAttendanceUser();
  const { row, workDate: date } = await currentAttendance(db, user.id);
  const resolved = await resolveWorkSchedule(db, user);
  const { schedule, assignment } = resolved;
  const [absence] = !row
    ? await db
        .select({ status: absences.status })
        .from(absences)
        .where(and(eq(absences.userId, user.id), eq(absences.workDate, date)))
        .limit(1)
    : [];
  const requiresWorkNote =
    (row?.employeeTypeSnapshot || user.employeeType) === "karyawan";
  const workProjects = requiresWorkNote
    ? await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.status, "active"))
        .orderBy(projects.name)
    : [];
  const snapshot = row
    ? {
        name: row.scheduleNameSnapshot,
        start: formatInTimeZone(
          row.scheduledStartAt,
          row.timezoneSnapshot,
          "HH:mm",
        ),
        end: formatInTimeZone(
          row.scheduledEndAt,
          row.timezoneSnapshot,
          "HH:mm",
        ),
      }
    : null;
  return {
    user: { name: user.name, employeeType: user.employeeType },
    requiresWorkNote,
    workProjects,
    date,
    dateLabel: date.split("-").reverse().join("/"),
    timezone: row?.timezoneSnapshot || env.APP_TIMEZONE,
    schedule:
      snapshot ||
      (schedule
        ? {
            name: schedule.name,
            start: schedule.startTime,
            end: schedule.endTime,
          }
        : null),
    scheduleSource: row ? "Jadwal saat absen masuk" : resolved.source,
    project:
      user.employeeType === "tukang"
        ? row?.projectNameSnapshot
          ? {
              name: row.projectNameSnapshot,
              address:
                assignment?.projectId === row.projectId
                  ? assignment.projectAddress
                  : "Project saat absen masuk",
            }
          : assignment
            ? {
                name: assignment.projectName,
                address: assignment.projectAddress,
              }
            : null
        : null,
    blockedReason: row
      ? ""
      : absence && ["sick", "leave"].includes(absence.status)
        ? "Anda tercatat sakit/izin pada tanggal ini. Hubungi petugas untuk memperbaiki catatan sebelum absen masuk."
        : resolved.blockedReason,
    serverNow: new Date().toISOString(),
    attendance: summary(row),
  };
}

export async function recordAttendance(kind, photo, reason = {}, work = {}) {
  const user = await requireAttendanceUser();
  if (
    !["in", "out"].includes(kind) ||
    typeof photo !== "string" ||
    photo.length > 900000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(photo)
  )
    return { error: "Foto tidak valid atau terlalu besar." };
  let file;
  try {
    const buffer = await sharp(Buffer.from(photo, "base64"), {
      limitInputPixels: 20000000,
    })
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const id = randomUUID();
    const key = `${id}.jpg`;
    await storePhoto(key, buffer.data);
    file = key;
    await db.transaction(async (tx) => {
      const [freshUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .for("update");
      if (!canUseAttendance(freshUser))
        throw new Error("Absensi pribadi tidak aktif untuk akun Anda.");
      const now = new Date();
      const current = await currentAttendance(tx, user.id, now);
      const existing = current.row;
      const workDate = kind === "out" ? current.workDate : today();
      if (kind === "in" && existing)
        throw new Error("Anda sudah check-in hari ini.");
      if (kind === "out" && (!existing || existing.checkOutAt))
        throw new Error("Check-out tidak tersedia.");
      const departure =
        kind === "out"
          ? checkoutPolicy(existing.scheduledEndAt, now, reason)
          : null;
      let workValues = {};
      if (
        kind === "out" &&
        (existing.employeeTypeSnapshot || freshUser.employeeType) === "karyawan"
      ) {
        if (!["project", "operational"].includes(work?.type))
          throw new Error("Pilih jenis pekerjaan sebelum absen pulang.");
        if (work.type === "project") {
          if (typeof work.projectId !== "string")
            throw new Error("Pilih project yang aktif.");
          const [project] = await tx
            .select()
            .from(projects)
            .where(
              and(
                eq(projects.id, work.projectId),
                eq(projects.status, "active"),
              ),
            )
            .for("share");
          if (!project) throw new Error("Pilih project yang aktif.");
          workValues = {
            workType: "project",
            workNote: null,
            projectId: project.id,
            projectCodeSnapshot: project.projectCode,
            projectNameSnapshot: project.name,
          };
        } else {
          const note = typeof work.note === "string" ? work.note.trim() : "";
          if (!note || note.length > 2000)
            throw new Error("Isi keterangan operasional 1–2000 karakter.");
          workValues = {
            workType: "operational",
            workNote: note,
            projectId: null,
            projectCodeSnapshot: null,
            projectNameSnapshot: null,
          };
        }
      }
      let values;
      if (kind === "in") {
        const [absence] = await tx
          .select()
          .from(absences)
          .where(
            and(eq(absences.userId, user.id), eq(absences.workDate, workDate)),
          )
          .for("update");
        if (absence && absence.status !== "unexcused")
          throw new Error(
            "Anda tercatat sakit/izin pada tanggal ini. Hubungi petugas untuk memperbaiki catatan sebelum absen masuk.",
          );
        if (absence) {
          await tx.delete(absences).where(eq(absences.id, absence.id));
          await recordActivity(
            tx,
            freshUser,
            "absences",
            "edit",
            `${workDate} · Tanpa Keterangan menjadi Hadir setelah absen masuk.`,
          );
        }
        const resolved = await resolveWorkSchedule(tx, freshUser, workDate);
        if (resolved.blockedReason) throw new Error(resolved.blockedReason);
        const { schedule, assignment } = resolved;
        const timing = attendanceTiming(
          workDate,
          schedule,
          env.APP_TIMEZONE,
          now,
        );
        const [accessRole] = freshUser.roleId
          ? await tx
              .select({ id: roles.id, name: roles.name })
              .from(roles)
              .where(eq(roles.id, freshUser.roleId))
          : [];
        const attendanceId = randomUUID();
        values = {
          id: attendanceId,
          attendanceCode: `ATT-${attendanceId.slice(0, 8)}`,
          userId: user.id,
          employeeTypeSnapshot: freshUser.employeeType,
          usernameSnapshot: freshUser.username,
          workType: freshUser.employeeType === "tukang" ? "project" : null,
          workDate,
          workScheduleId: schedule.id,
          projectAssignmentId: assignment?.id,
          projectId: assignment?.projectId,
          userCodeSnapshot: user.userCode,
          fullNameSnapshot: user.name,
          roleSnapshot: freshUser.role,
          roleIdSnapshot: accessRole?.id || null,
          roleNameSnapshot: accessRole?.name || null,
          scheduleCodeSnapshot: schedule.scheduleCode,
          scheduleNameSnapshot: schedule.name,
          timezoneSnapshot: env.APP_TIMEZONE,
          projectCodeSnapshot: assignment?.projectCode,
          projectNameSnapshot: assignment?.projectName,
          ...timing,
          checkInAt: now,
          checkInPhotoId: id,
        };
      }
      await tx.insert(mediaFiles).values({
        id,
        ownerUserId: user.id,
        purpose: kind === "in" ? "check_in" : "check_out",
        storageKey: key,
        mimeType: "image/jpeg",
        sizeBytes: buffer.data.length,
        widthPx: buffer.info.width,
        heightPx: buffer.info.height,
        createdById: user.id,
      });
      if (kind === "in") await tx.insert(attendances).values(values);
      else
        await tx
          .update(attendances)
          .set({
            checkOutAt: now,
            checkOutPhotoId: id,
            ...departure,
            ...workValues,
          })
          .where(eq(attendances.id, existing.id));
      const projectName =
        kind === "in"
          ? values.projectNameSnapshot
          : workValues.projectNameSnapshot || existing.projectNameSnapshot;
      await recordActivity(
        tx,
        freshUser,
        "attendance",
        kind === "in" ? "check_in" : "check_out",
        `${projectName || "Karyawan"} · ${workDate}`,
      );
    });
    return { success: true };
  } catch (error) {
    if (file) await deletePhoto(file).catch(() => {});
    const known = [
      "Anda tercatat sakit/izin pada tanggal ini. Hubungi petugas untuk memperbaiki catatan sebelum absen masuk.",
      "Pilih jenis pekerjaan sebelum absen pulang.",
      "Pilih project yang aktif.",
      "Isi keterangan operasional 1–2000 karakter.",
      "Absensi pribadi tidak aktif untuk akun Anda.",
      "Pulang lebih awal wajib memilih alasan dan mengisi keterangan 5–1000 karakter.",
      "Anda sudah check-in hari ini.",
      "Check-out tidak tersedia.",
      "Jadwal kerja belum ditentukan. Hubungi Admin.",
      "Jadwal kerja project belum ditentukan. Hubungi Admin.",
      "Jadwal kerja nonaktif. Hubungi Admin.",
      "Anda belum memiliki penempatan project untuk tanggal kerja ini.",
    ];
    return {
      error: known.includes(error.message)
        ? error.message
        : "Gagal menyimpan absensi. Periksa foto dan koneksi database.",
    };
  }
}
