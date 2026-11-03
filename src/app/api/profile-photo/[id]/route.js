import { readPhoto } from "@/lib/server/photo-storage";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { mediaFiles } from "@/lib/server/db/schema";
import { getSessionUser } from "@/lib/server/auth/session";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  const user = await getSessionUser();
  if (!user?.isActive) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || user.profilePhotoId !== id)
    return new Response(null, { status: 404 });
  const [file] = await db
    .select()
    .from(mediaFiles)
    .where(
      and(
        eq(mediaFiles.id, id),
        eq(mediaFiles.ownerUserId, user.id),
        eq(mediaFiles.purpose, "profile"),
      ),
    )
    .limit(1);
  if (!file) return new Response(null, { status: 404 });
  try {
    return new Response(await readPhoto(file.storageKey), {
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
