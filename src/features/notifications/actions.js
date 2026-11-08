"use server";
import { and, eq, isNull, desc, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { notifications, projectAssignments } from "@/lib/server/db/schema";
import { requireUser } from "@/lib/server/auth/session";

async function recipient() {
  const user = await requireUser();

  return user.id;
}

export async function listNotifications() {
  const id = await recipient();
  const rows = await db
    .select({
      id: notifications.id,
      projectName: notifications.projectName,
      workDate: projectAssignments.workDate,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .leftJoin(
      projectAssignments,
      eq(projectAssignments.id, notifications.assignmentId),
    )
    .where(eq(notifications.recipientId, id))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(50);
  const [unread] = await db
    .select({ total: count() })
    .from(notifications)
    .leftJoin(
      projectAssignments,
      eq(projectAssignments.id, notifications.assignmentId),
    )
    .where(
      and(eq(notifications.recipientId, id), isNull(notifications.readAt)),
    );
  return {
    items: rows.map((r) => ({ ...r, readAt: r.readAt?.toISOString() || null })),
    unread: unread.total,
  };
}

export async function readNotification(rawId) {
  const recipientId = await recipient();
  const id = z.uuid().parse(rawId);
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select({
        id: notifications.id,
        projectName: notifications.projectName,
        workDate: projectAssignments.workDate,
        projectAddress: notifications.projectAddress,
      })
      .from(notifications)
      .leftJoin(
        projectAssignments,
        eq(projectAssignments.id, notifications.assignmentId),
      )
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientId, recipientId),
        ),
      )
      .limit(1);
    if (!item) throw new Error("Notifikasi tidak ditemukan.");
    await tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientId, recipientId),
          isNull(notifications.readAt),
        ),
      );
    return item;
  });
}

export async function markAllNotificationsRead() {
  const id = await recipient();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.recipientId, id), isNull(notifications.readAt)),
    );
}
