import { requirePermission } from "@/lib/server/auth/permissions";
import { photoRecapData } from "@/features/photo-recap/queries";
import { createPhotoRecapPdf } from "@/features/photo-recap/pdf";
import { recordActivity } from "@/features/activity-logs/server";
import { db } from "@/lib/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const actor = await requirePermission("photo-recap", "read");
  let data;
  try {
    data = await photoRecapData(
      Object.fromEntries(new URL(request.url).searchParams),
    );
  } catch {
    return new Response(
      "Filter tidak valid atau data terlalu banyak. Persempit rentang tanggal/role/project.",
      { status: 400 },
    );
  }
  if (data.records.length > 1000)
    return new Response(
      "Maksimal 1000 catatan per PDF. Persempit filter tanggal, role, project, atau pengguna.",
      { status: 400 },
    );
  try {
    const pdf = await createPhotoRecapPdf(data);
    await recordActivity(
      db,
      actor,
      "photo-recap",
      "export",
      `${data.filters.from}–${data.filters.to} · ${data.records.length} catatan PDF`,
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rekap-foto-${data.filters.from}-${data.filters.to}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[photo-recap-pdf]", { code: error?.code || error?.name });
    return new Response(
      "PDF belum dapat dibuat. Silakan coba lagi atau hubungi Admin.",
      { status: 500 },
    );
  }
}
