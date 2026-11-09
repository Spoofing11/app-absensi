import "server-only";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { inArray } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/server/db";
import { mediaFiles } from "@/lib/server/db/schema";
import { readPhoto } from "@/lib/server/photo-storage";
import { APPROVAL_LABELS } from "@/lib/shared/attendance-review";
import { ABSENCE_LABELS } from "@/features/absences/labels";

export async function createPhotoRecapPdf(data) {
  const doc = new PDFDocument({
    size: "A3",
    layout: "landscape",
    margin: 28,
    autoFirstPage: false,
    info: {
      Title: "Rekap Foto Absensi",
      Author: "PT Composite Interior Prima",
    },
  });
  const chunks = [];
  const completed = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  // Attach rejection handling before asynchronous storage reads begin.
  completed.catch(() => {});
  const photoIds = [
    ...new Set(
      data.records
        .flatMap((r) => [
          r.checkInPhotoId,
          r.approvalStatus !== "rejected" ? r.checkOutPhotoId : null,
        ])
        .filter(Boolean),
    ),
  ];
  const media = photoIds.length
    ? await db
        .select({
          id: mediaFiles.id,
          owner: mediaFiles.ownerUserId,
          key: mediaFiles.storageKey,
        })
        .from(mediaFiles)
        .where(inArray(mediaFiles.id, photoIds))
    : [];
  const byId = new Map(media.map((m) => [m.id, m]));
  const fallback = await sharp(
    await readFile(path.join(process.cwd(), "public/images/no-photo.svg")),
  )
    .resize(120, 140, { fit: "contain", background: "#e8edf4" })
    .png()
    .toBuffer();
  const cache = new Map();
  let pageNumber = 0;
  async function photo(id, userId) {
    const item = byId.get(id);
    if (!item || item.owner !== userId) return fallback;
    if (cache.has(id)) return cache.get(id);
    let buffer;
    try {
      buffer = await sharp(await readPhoto(item.key), {
        limitInputPixels: 20000000,
      })
        .rotate()
        .resize(120, 140, { fit: "contain", background: "#ffffff" })
        .jpeg({ quality: 65 })
        .toBuffer();
    } catch {
      buffer = fallback;
    }
    cache.set(id, buffer);
    return buffer;
  }
  const left = 28,
    tableWidth = 1134,
    nameWidth = 145,
    totalWidth = 65;
  const dayWidth = (tableWidth - nameWidth - totalWidth) / 7;
  const rowHeight = 150;
  const text = (value, x, y, width, height = 24, size = 8, color = "#30271f") =>
    doc
      .fillColor(color)
      .fontSize(size)
      .text(String(value || ""), x, y, { width, height, ellipsis: true });
  function newPage(week) {
    doc.addPage();
    pageNumber++;
    text(
      "PT COMPOSITE INTERIOR PRIMA — REKAP FOTO ABSENSI",
      left,
      24,
      tableWidth,
      24,
      16,
    );
    text(
      `Filter: ${data.filters.from} s/d ${data.filters.to} | ${data.filters.q ? `Pengguna: ${data.filters.q} | ` : ""}Halaman ${pageNumber}`,
      left,
      52,
      tableWidth,
      18,
      9,
    );
    text(
      `Role: ${data.roleOptions.find((r) => r.id === data.filters.role)?.name || "Semua"} | Project: ${data.projectOptions.find((p) => p.id === data.filters.project)?.name || "Semua"}`,
      left,
      68,
      tableWidth,
      18,
      9,
    );
    text(
      `Minggu ke-${data.weeks.indexOf(week) + 1}: ${week.start} s/d ${week.dates[6]} — Senin–Minggu`,
      left,
      88,
      tableWidth,
      20,
      11,
    );
    doc.fillColor("#eee8df").rect(left, 115, tableWidth, 38).fill();
    text("NAMA PENGGUNA", left + 5, 125, nameWidth - 10);
    week.dates.forEach((date, i) => {
      const day = new Date(date + "T00:00:00Z").toLocaleDateString("id-ID", {
        timeZone: "UTC",
        weekday: "long",
      });
      text(
        `${day}\n${date}`,
        left + nameWidth + i * dayWidth + 4,
        120,
        dayWidth - 8,
        30,
        9,
      );
    });
    text(
      "TOTAL\nKEHADIRAN",
      left + tableWidth - totalWidth + 4,
      120,
      totalWidth - 8,
      30,
    );
    text(
      "Jam merah = terlambat. No Photo = foto tidak ada/tidak tersedia atau absen pulang ditolak. Ditolak tidak dihitung hadir. Tanggal di luar pilihan tidak ditampilkan dan tidak dihitung.",
      left,
      798,
      tableWidth,
      14,
      8,
    );
  }
  try {
    if (!data.weeks.length) {
      doc.addPage();
      text(
        "Rekap Foto Absensi — Tidak ada data sesuai filter.",
        left,
        40,
        tableWidth,
        40,
        14,
      );
    }
    for (const week of data.weeks) {
      let y = 153;
      newPage(week);
      for (const person of week.users) {
        if (y + rowHeight > 790) {
          newPage(week);
          y = 153;
        }
        await Promise.all(
          week.dates.flatMap((date) => {
            const record = person.days[date];
            if (!record) return [];
            return [
              photo(record.checkInPhotoId, record.userId),
              photo(
                record.approvalStatus === "rejected"
                  ? null
                  : record.checkOutPhotoId,
                record.userId,
              ),
            ];
          }),
        );
        doc
          .strokeColor("#d4ccc0")
          .lineWidth(0.5)
          .rect(left, y, tableWidth, rowHeight)
          .stroke();
        text(person.name, left + 5, y + 8, nameWidth - 10, 45, 10);
        text(person.code, left + 5, y + 58, nameWidth - 10);
        text(
          `${person.total} hari`,
          left + tableWidth - totalWidth + 5,
          y + 12,
          totalWidth - 10,
          30,
          12,
        );
        for (let i = 0; i < 7; i++) {
          const date = week.dates[i];
          const x = left + nameWidth + i * dayWidth;
          const row = person.days[date];
          doc
            .moveTo(x, y)
            .lineTo(x, y + rowHeight)
            .stroke();
          if (date < data.filters.from || date > data.filters.to) {
            text("—", x + 4, y + 12, dayWidth - 8);
            continue;
          }
          if (!row) {
            text("Tidak ada catatan", x + 4, y + 12, dayWidth - 8);
            continue;
          }
          const width = (dayWidth - 12) / 2;
          doc.image(await photo(row.checkInPhotoId, row.userId), x + 4, y + 5, {
            fit: [width, 78],
            align: "center",
            valign: "center",
          });
          doc.image(
            await photo(
              row.approvalStatus === "rejected" ? null : row.checkOutPhotoId,
              row.userId,
            ),
            x + 8 + width,
            y + 5,
            { fit: [width, 78], align: "center", valign: "center" },
          );
          const time = (value) =>
            value
              ? formatInTimeZone(value, row.timezoneSnapshot, "HH:mm")
              : "—";
          text(
            `M ${time(row.checkInAt)}`,
            x + 4,
            y + 86,
            width,
            16,
            9,
            row.lateSeconds > 0 ? "#b42318" : "#30271f",
          );
          text(
            `P ${time(row.checkOutAt)}`,
            x + 8 + width,
            y + 86,
            width,
            16,
            9,
          );
          text(
            row.roleNameSnapshot || "—",
            x + 4,
            y + 103,
            dayWidth - 8,
            12,
            7,
          );
          text(
            row.projectNameSnapshot || "Tanpa Project",
            x + 4,
            y + 116,
            dayWidth - 8,
            12,
            7,
          );
          text(
            row.absenceStatus
              ? ABSENCE_LABELS[row.absenceStatus]
              : APPROVAL_LABELS[row.approvalStatus] || "",
            x + 4,
            y + 131,
            dayWidth - 8,
            15,
            8,
            row.approvalStatus === "rejected" ? "#b42318" : "#30271f",
          );
        }
        y += rowHeight;
      }
    }
    const rejected = data.records.filter((r) => r.approvalReason);
    if (rejected.length) {
      doc.addPage();
      doc
        .fillColor("#30271f")
        .fontSize(16)
        .text("Keterangan Penolakan", 28, 28);
      for (const row of rejected) {
        doc
          .moveDown()
          .fontSize(10)
          .fillColor("#30271f")
          .text(
            `${row.workDate} — ${row.fullNameSnapshot} — ${row.projectNameSnapshot || "Tanpa Project"}`,
            { width: tableWidth },
          );
        doc.fontSize(9).text(row.approvalReason, { width: tableWidth });
      }
    }
    doc.end();
    return await completed;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}
