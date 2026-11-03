import { describe, it, expect } from "vitest";
import {
  checkoutPolicy,
  durationLabel,
} from "../../src/features/attendance/policy.js";
describe("Alasan pulang awal", () => {
  const end = new Date("2026-11-02T10:00:00Z");
  it("wajib sebelum jadwal pulang", () => {
    expect(() =>
      checkoutPolicy(end, new Date("2026-11-02T07:00:00Z")),
    ).toThrow();
    expect(
      checkoutPolicy(end, new Date("2026-11-02T07:00:00Z"), {
        category: "Sakit",
        text: "Sakit dan perlu istirahat",
      }).earlySeconds,
    ).toBe(10800);
  });
  it("tidak wajib tepat atau setelah jam pulang dan mengabaikan alasan lama", () => {
    for (const date of [end, new Date("2026-11-02T12:00:00Z")])
      expect(
        checkoutPolicy(end, date, { category: "Sakit", text: "alasan lama" }),
      ).toEqual({
        earlySeconds: 0,
        earlyReasonCategory: null,
        earlyReasonText: null,
      });
  });
  it("menolak kategori atau keterangan tidak valid", () => {
    for (const reason of [
      { category: "Tidak dikenal", text: "Cukup panjang" },
      { category: "Sakit", text: " " },
      { category: "Sakit", text: "a".repeat(1001) },
    ])
      expect(() =>
        checkoutPolicy(end, new Date("2026-11-02T07:00:00Z"), reason),
      ).toThrow();
  });
  it("mengikuti tanggal pulang snapshot shift malam", () => {
    expect(() =>
      checkoutPolicy(
        new Date("2026-11-03T23:00:00Z"),
        new Date("2026-11-03T22:59:59Z"),
      ),
    ).toThrow();
    expect(
      checkoutPolicy(
        new Date("2026-11-03T23:00:00Z"),
        new Date("2026-11-03T23:00:00Z"),
      ),
    ).toHaveProperty("earlySeconds", 0);
  });
  it("menampilkan durasi terlambat yang mudah dibaca", () => {
    expect(durationLabel(7260)).toBe("2 jam 1 menit");
    expect(durationLabel(1)).toBe("1 menit");
  });
});
