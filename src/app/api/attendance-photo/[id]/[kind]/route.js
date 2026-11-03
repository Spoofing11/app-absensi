import { readPhoto } from "@/lib/server/photo-storage";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { attendances, mediaFiles } from "@/lib/server/db/schema";
import { getSessionUser } from "@/lib/server/auth/session";
import { permissionsFor } from "@/lib/server/auth/permissions";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  const user = await getSessionUser();
  if (!user?.isActive) return new Response(null, { status: 401 });
  const permissions = await permissionsFor(user);
  if (!permissions.history?.read) return new Response(null, { status: 403 });
  const { id, kind } = await params;
  if (!z.uuid().safeParse(id).success || !["in", "out"].includes(kind))
    return new Response(null, { status: 404 });
  const [row] = await db
    .select()
    .from(attendances)
    .where(eq(attendances.id, id))
    .limit(1);
  const photoId = kind === "in" ? row?.checkInPhotoId : row?.checkOutPhotoId;
  if (!photoId) return new Response(null, { status: 404 });
  const [photo] = await db
    .select()
    .from(mediaFiles)
    .where(eq(mediaFiles.id, photoId))
    .limit(1);
  if (!photo || photo.ownerUserId !== row.userId)
    return new Response(null, { status: 404 });
  try {
    const data = await readPhoto(photo.storageKey);
    return new Response(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
