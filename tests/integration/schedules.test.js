import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { eq, and, inArray } from "drizzle-orm";
const auth = vi.hoisted(() => ({ user: null }));
vi.mock("@/lib/server/auth/session", () => ({
  getSessionUser: async () => auth.user,
  requireUser: async () => {
    if (!auth.user) throw new Error("Unauthenticated");
    return auth.user;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destination) => {
    throw new Error(`REDIRECT:${destination}`);
  },
}));
import { db, pool } from "@/lib/server/db";
import {
  users,
  roles,
  rolePermissions,
  projects,
  projectAssignments,
  workSchedules,
  notifications,
  attendances,
  mediaFiles,
} from "@/lib/server/db/schema";
import { resolveWorkSchedule } from "@/features/schedules/resolver";
import { saveAssignment, endAssignment } from "@/features/assignments/actions";
import { saveSchedule, deleteSchedule } from "@/features/schedules/actions";
import {
  attendanceContext,
  recordAttendance,
} from "@/features/attendance/actions";
import { saveProject } from "@/features/projects/actions";
import { saveRole } from "@/features/roles/actions";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  historyData,
  historyDetail,
} from "@/features/attendance-history/queries";
import { GET as attendancePhoto } from "../../src/app/api/attendance-photo/[id]/[kind]/route.js";
import { env } from "@/lib/server/env";
const key = randomUUID().slice(0, 8);
const ids = Object.fromEntries(
  [
    "adminRole",
    "role",
    "emptyRole",
    "admin",
    "employee",
    "worker",
    "race",
    "snapshot",
    "scheduleA",
    "scheduleB",
    "projectA",
    "projectB",
  ].map((k) => [k, randomUUID()]),
);
const userIds = [ids.admin, ids.employee, ids.worker, ids.race, ids.snapshot];
const extraSchedules = [];
const form = (fields) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, String(v));
  return data;
};
async function user(id) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}
beforeAll(async () => {
  await db.insert(workSchedules).values([
    {
      id: ids.scheduleA,
      scheduleCode: `QA-A-${key}`,
      name: `QA Pagi ${key}`,
      startTime: "08:00:00",
      endTime: "17:00:00",
    },
    {
      id: ids.scheduleB,
      scheduleCode: `QA-B-${key}`,
      name: `QA Malam ${key}`,
      startTime: "22:00:00",
      endTime: "06:00:00",
    },
  ]);
  await db.insert(roles).values([
    { id: ids.adminRole, name: `QA System ${key}`, isSystem: true },
    { id: ids.role, name: `QA Worker ${key}`, workScheduleId: ids.scheduleA },
    { id: ids.emptyRole, name: `QA Empty ${key}` },
  ]);
  await db.insert(rolePermissions).values({
    roleId: ids.role,
    feature: "attendance",
    read: true,
    create: true,
    edit: true,
  });
  for (const [index, id] of userIds.entries())
    await db.insert(users).values({
      id,
      name: `QA Schedule ${key} ${index}`,
      username: `qa_sch_${key}_${index}`,
      email: `qa_sch_${key}_${index}@example.invalid`,
      userCode: `QA-${key}-${index}`,
      role:
        id === ids.admin
          ? "admin"
          : id === ids.employee || id === ids.snapshot
            ? "karyawan"
            : "tukang",
      roleId: id === ids.admin ? ids.adminRole : ids.role,
      employeeType:
        id === ids.admin
          ? "none"
          : id === ids.employee || id === ids.snapshot
            ? "karyawan"
            : "tukang",
      workScheduleId: ids.scheduleB,
    });
  await db.insert(projects).values([
    {
      id: ids.projectA,
      projectCode: `QA-A-${key}`,
      name: `QA Project A ${key}`,
      address: "QA A",
    },
    {
      id: ids.projectB,
      projectCode: `QA-B-${key}`,
      name: `QA Project B ${key}`,
      address: "QA B",
      workScheduleId: ids.scheduleB,
    },
  ]);
});
beforeEach(async () => {
  await db
    .update(roles)
    .set({ workScheduleId: ids.scheduleA })
    .where(eq(roles.id, ids.role));
  await db
    .update(workSchedules)
    .set({ isActive: true })
    .where(eq(workSchedules.id, ids.scheduleB));
  auth.user = await user(ids.admin);
});
afterAll(async () => {
  try {
    const files = await db
      .select({ key: mediaFiles.storageKey })
      .from(mediaFiles)
      .where(inArray(mediaFiles.ownerUserId, userIds));
    await db.delete(attendances).where(inArray(attendances.userId, userIds));
    await db.delete(mediaFiles).where(inArray(mediaFiles.ownerUserId, userIds));
    await db
      .delete(projectAssignments)
      .where(inArray(projectAssignments.workerId, userIds));
    await db
      .delete(notifications)
      .where(inArray(notifications.recipientId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db
      .delete(projects)
      .where(inArray(projects.id, [ids.projectA, ids.projectB]));
    await db
      .delete(roles)
      .where(inArray(roles.id, [ids.adminRole, ids.role, ids.emptyRole]));
    await db
      .delete(workSchedules)
      .where(
        inArray(workSchedules.id, [
          ids.scheduleA,
          ids.scheduleB,
          ...extraSchedules,
        ]),
      );
    const root = path.resolve(env.STORAGE_ROOT);
    for (const file of files) {
      const target = path.resolve(root, file.key);
      if (path.dirname(target) !== root)
        throw new Error("Unexpected QA media path");
      await unlink(target);
    }
  } finally {
    await pool.end();
  }
});
describe("Jadwal otomatis dan penempatan tanpa tanggal", () => {
  it("Karyawan mengikuti Role dan mengabaikan jadwal User lama", async () => {
    const r = await resolveWorkSchedule(db, await user(ids.employee));
    expect(r.schedule.id).toBe(ids.scheduleA);
    expect(r.source).toContain("Role");
    const noRole = { ...(await user(ids.employee)), roleId: ids.emptyRole };
    expect((await resolveWorkSchedule(db, noRole)).schedule).toBeNull();
    expect(
      (await resolveWorkSchedule(db, await user(ids.admin))).schedule,
    ).toBeNull();
  });
  it("Project diprioritaskan, lalu Role; penempatan diganti/diakhiri tanpa menghapus riwayat", async () => {
    await saveAssignment(
      form({ workerId: ids.worker, projectId: ids.projectA }),
    );
    let rows = await db
      .select()
      .from(projectAssignments)
      .where(eq(projectAssignments.workerId, ids.worker));
    const first = rows[0];
    expect(first.startDate).toBeNull();
    expect(first.isActive).toBe(true);
    expect(
      (await resolveWorkSchedule(db, await user(ids.worker))).schedule.id,
    ).toBe(ids.scheduleA);
    await saveAssignment(
      form({ id: first.id, workerId: ids.worker, projectId: ids.projectA }),
    );
    expect(
      (
        await db
          .select()
          .from(notifications)
          .where(eq(notifications.recipientId, ids.worker))
      ).length,
    ).toBe(1);
    await saveAssignment(
      form({ id: first.id, workerId: ids.worker, projectId: ids.projectB }),
    );
    rows = await db
      .select()
      .from(projectAssignments)
      .where(eq(projectAssignments.workerId, ids.worker));
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.isActive)).toHaveLength(1);
    const old = rows.find((r) => r.id === first.id);
    expect(old.endedAt).not.toBeNull();
    expect(old.createdAt.getTime()).toBe(first.createdAt.getTime());
    expect(
      (await resolveWorkSchedule(db, await user(ids.worker))).schedule.id,
    ).toBe(ids.scheduleB);
    await db
      .update(workSchedules)
      .set({ isActive: false })
      .where(eq(workSchedules.id, ids.scheduleB));
    expect(
      (await resolveWorkSchedule(db, await user(ids.worker))).blockedReason,
    ).toContain("nonaktif");
    await db
      .update(workSchedules)
      .set({ isActive: true })
      .where(eq(workSchedules.id, ids.scheduleB));
    const active = rows.find((r) => r.isActive);
    await endAssignment(form({ id: active.id }));
    expect(
      (await resolveWorkSchedule(db, await user(ids.worker))).blockedReason,
    ).toContain("penempatan");
    expect(
      (
        await db
          .select()
          .from(projectAssignments)
          .where(eq(projectAssignments.workerId, ids.worker))
      ).length,
    ).toBe(2);
    expect(
      (
        await db
          .select()
          .from(notifications)
          .where(eq(notifications.recipientId, ids.worker))
      ).length,
    ).toBe(2);
    await expect(
      saveAssignment(
        form({ id: first.id, workerId: ids.worker, projectId: ids.projectA }),
      ),
    ).rejects.toThrow();
  });
  it("dua permintaan bersamaan tidak menghasilkan dua penempatan aktif", async () => {
    const results = await Promise.allSettled([
      saveAssignment(form({ workerId: ids.race, projectId: ids.projectA })),
      saveAssignment(form({ workerId: ids.race, projectId: ids.projectB })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rows = await db
      .select()
      .from(projectAssignments)
      .where(
        and(
          eq(projectAssignments.workerId, ids.race),
          eq(projectAssignments.isActive, true),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(
      (
        await db
          .select()
          .from(notifications)
          .where(eq(notifications.recipientId, ids.race))
      ).length,
    ).toBe(1);
  });
  it("CRUD jadwal memeriksa izin, waktu, dan referensi Role/Project", async () => {
    const name = `QA Extra ${key}`;
    await saveSchedule(
      form({ name, startTime: "09:00", endTime: "18:00", isActive: "on" }),
    );
    const [row] = await db
      .select()
      .from(workSchedules)
      .where(eq(workSchedules.name, name));
    extraSchedules.push(row.id);
    await expect(
      saveSchedule(
        form({
          name: `QA Invalid ${key}`,
          startTime: "09:00",
          endTime: "09:00",
          isActive: "on",
        }),
      ),
    ).rejects.toThrow();
    await expect(
      saveSchedule(
        form({
          id: ids.scheduleA,
          name: "QA",
          startTime: "08:00",
          endTime: "17:00",
        }),
      ),
    ).rejects.toThrow();
    await expect(deleteSchedule(form({ id: ids.scheduleA }))).rejects.toThrow();
    auth.user = await user(ids.employee);
    await expect(
      saveSchedule(
        form({
          name: "No permission",
          startTime: "09:00",
          endTime: "18:00",
          isActive: "on",
        }),
      ),
    ).rejects.toThrow();
    auth.user = await user(ids.admin);
    await saveSchedule(
      form({
        id: row.id,
        name,
        startTime: "10:00",
        endTime: "19:00",
        isActive: "on",
      }),
    );
    const [updated] = await db
      .select()
      .from(workSchedules)
      .where(eq(workSchedules.id, row.id));
    expect(updated.startTime).toBe("10:00:00");
    await deleteSchedule(form({ id: row.id }));
  });
  it("Role/Project menolak jadwal tidak aktif", async () => {
    await db
      .update(workSchedules)
      .set({ isActive: false })
      .where(eq(workSchedules.id, ids.scheduleB));
    await expect(
      saveProject(
        form({
          id: ids.projectA,
          name: "QA",
          address: "QA",
          workScheduleId: ids.scheduleB,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      saveRole(
        form({
          id: ids.emptyRole,
          name: `QA Empty ${key}`,
          workScheduleId: ids.scheduleB,
        }),
      ),
    ).rejects.toThrow();
  });
  it("perubahan jadwal setelah check-in tidak mengubah snapshot atau menghalangi check-out", async () => {
    auth.user = await user(ids.snapshot);
    const photo = (
      await sharp({
        create: { width: 32, height: 32, channels: 3, background: "#e8dfd0" },
      })
        .jpeg()
        .toBuffer()
    ).toString("base64");
    expect(await recordAttendance("in", photo)).toEqual({ success: true });
    const [original] = await db
      .select()
      .from(attendances)
      .where(eq(attendances.userId, ids.snapshot));
    expect(original.workScheduleId).toBe(ids.scheduleA);
    await db
      .update(roles)
      .set({ workScheduleId: ids.scheduleB })
      .where(eq(roles.id, ids.role));
    const context = await attendanceContext();
    expect(context.schedule.start).toBe("08:00");
    expect(context.scheduleSource).toContain("saat absen masuk");
    expect(
      await recordAttendance("out", photo, {
        category: "Izin atasan",
        text: "Pengujian selesai lebih awal",
      }),
    ).toEqual({ success: true });
    const [after] = await db
      .select()
      .from(attendances)
      .where(eq(attendances.id, original.id));
    expect(after.scheduledStartAt.getTime()).toBe(
      original.scheduledStartAt.getTime(),
    );
    expect(after.checkOutAt).not.toBeNull();
    // Simulate an open shift started yesterday; checkout must complete that row, not create today's row.
    const date = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
    const previous = new Date(`${date}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    const previousDate = previous.toISOString().slice(0, 10);
    const yesterdayStart = fromZonedTime(
      `${previousDate}T22:00:00`,
      env.APP_TIMEZONE,
    );
    const todayEnd = fromZonedTime(`${date}T06:00:00`, env.APP_TIMEZONE);
    await db
      .update(attendances)
      .set({
        workDate: previousDate,
        checkInAt: yesterdayStart,
        scheduledStartAt: yesterdayStart,
        scheduledEndAt: todayEnd,
        checkOutAt: null,
      })
      .where(eq(attendances.id, original.id));
    expect((await attendanceContext()).date).toBe(previousDate);
    expect(
      await recordAttendance("out", photo, {
        category: "Izin atasan",
        text: "Pengujian selesai lebih awal",
      }),
    ).toEqual({ success: true });
    const [overnight] = await db
      .select()
      .from(attendances)
      .where(eq(attendances.id, original.id));
    expect(overnight.workDate).toBe(previousDate);
    expect(overnight.checkOutAt).not.toBeNull();
  });
  it("pulang awal wajib beralasan; alasan dan snapshot Role tersimpan", async () => {
    auth.user = await user(ids.employee);
    const photo = (
      await sharp({
        create: { width: 32, height: 32, channels: 3, background: "#e8dfd0" },
      })
        .jpeg()
        .toBuffer()
    ).toString("base64");
    expect(await recordAttendance("in", photo)).toEqual({ success: true });
    const [row] = await db
      .select()
      .from(attendances)
      .where(eq(attendances.userId, ids.employee));
    expect(row.roleIdSnapshot).toBe(ids.role);
    expect(row.roleNameSnapshot).toContain("QA Worker");
    await db
      .update(attendances)
      .set({
        scheduledEndAt: new Date(Date.now() + 3600000),
        lateSeconds: 7260,
      })
      .where(eq(attendances.id, row.id));
    const before = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.ownerUserId, ids.employee));
    expect(await recordAttendance("out", photo)).toHaveProperty("error");
    const after = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.ownerUserId, ids.employee));
    expect(after).toHaveLength(before.length);
    expect((await attendanceContext()).attendance.lateSeconds).toBe(7260);
    expect(
      await recordAttendance("out", photo, {
        category: "Sakit",
        text: "Sakit dan perlu beristirahat",
      }),
    ).toEqual({ success: true });
    const [saved] = await db
      .select()
      .from(attendances)
      .where(eq(attendances.id, row.id));
    expect(saved.earlySeconds).toBeGreaterThan(0);
    expect(saved.earlyReasonCategory).toBe("Sakit");
  });
  it("riwayat, rekap, pagination, filter dan foto mengikuti snapshot serta izin", async () => {
    auth.user = await user(ids.admin);
    const date = formatInTimeZone(new Date(), env.APP_TIMEZONE, "yyyy-MM-dd");
    const [original] = await db
      .select()
      .from(attendances)
      .where(eq(attendances.userId, ids.employee));
    // Build a bounded QA history including legacy entries and more than one page.
    const samples = Array.from({ length: 27 }, (_, i) => ({
      ...original,
      id: randomUUID(),
      attendanceCode: `QA-${key}-${i}`,
      workDate: date,
      roleIdSnapshot: i === 0 ? null : ids.role,
      roleNameSnapshot: i === 0 ? null : original.roleNameSnapshot,
      earlyReasonCategory: null,
      earlyReasonText: null,
      earlySeconds: 0,
      lateSeconds: i === 1 ? 60 : 0,
      checkOutAt: i === 2 ? null : original.checkOutAt,
      checkInPhotoId: null,
      checkOutPhotoId: null,
    }));
    await db.insert(attendances).values(samples);
    const filter = { from: date, to: date, q: `QA Schedule ${key}` };
    const detail = await historyData({ ...filter, view: "detail" });
    expect(detail.total).toBe(28);
    expect(detail.rows).toHaveLength(25);
    expect(detail.pages).toBe(2);
    expect((await historyData({ ...filter, page: 2 })).rows).toHaveLength(3);
    expect(detail.groups.some((g) => g.key.startsWith("legacy:"))).toBe(true);
    await db
      .update(roles)
      .set({ name: `QA Renamed ${key}` })
      .where(eq(roles.id, ids.role));
    const historical = await historyDetail(original.id);
    expect(historical.roleNameSnapshot).toBe(original.roleNameSnapshot);
    const recap = await historyData({ ...filter, view: "recap" });
    expect(recap.rows).toHaveLength(2);
    await db
      .update(attendances)
      .set({ roleNameSnapshot: original.roleNameSnapshot.toLowerCase() })
      .where(eq(attendances.id, samples[1].id));
    const exactGroups = await historyData({ ...filter, view: "detail" });
    expect(exactGroups.groups).toHaveLength(3);
    expect(
      exactGroups.rows.every((row) =>
        exactGroups.groups.some((group) => group.key === row.groupKey),
      ),
    ).toBe(true);

    expect(recap.rows.some((r) => Number(r.open) > 0)).toBe(true);
    expect((await historyData({ ...filter, status: "early" })).total).toBe(1);
    expect((await historyData({ ...filter, q: "QA %" })).total).toBe(0);
    const photo = await attendancePhoto(
      new Request("http://localhost/api/photo"),
      { params: Promise.resolve({ id: original.id, kind: "in" }) },
    );
    expect(photo.status).toBe(200);
    expect(photo.headers.get("Cache-Control")).toContain("no-store");
    expect((await photo.arrayBuffer()).byteLength).toBeGreaterThan(0);
    auth.user = await user(ids.employee);
    await expect(historyData(filter)).rejects.toThrow();
    expect(
      (
        await attendancePhoto(new Request("http://localhost/api/photo"), {
          params: Promise.resolve({ id: original.id, kind: "in" }),
        })
      ).status,
    ).toBe(403);
    auth.user = null;
    expect(
      (
        await attendancePhoto(new Request("http://localhost/api/photo"), {
          params: Promise.resolve({ id: original.id, kind: "in" }),
        })
      ).status,
    ).toBe(401);
  });
});
