import { describe, it, expect } from "vitest";
import { attendanceTiming } from "../../src/features/schedules/timing.js";
describe("Jam kerja dan zona waktu", () => {
  it("menghitung keterlambatan berdasarkan jam lokal", () => {
    const result = attendanceTiming(
      "2026-11-02",
      { startTime: "08:00:00", endTime: "17:00:00" },
      "Asia/Jakarta",
      new Date("2026-11-02T01:15:00Z"),
    );
    expect(result.scheduledStartAt.toISOString()).toBe(
      "2026-11-02T01:00:00.000Z",
    );
    expect(result.lateSeconds).toBe(900);
  });
  it("tidak menghitung nilai negatif untuk kedatangan awal", () => {
    expect(
      attendanceTiming(
        "2026-11-02",
        { startTime: "08:00:00", endTime: "17:00:00" },
        "Asia/Jakarta",
        new Date("2026-11-02T00:30:00Z"),
      ).lateSeconds,
    ).toBe(0);
  });
  it("menyimpan jam pulang pada hari berikutnya untuk shift malam", () => {
    const r = attendanceTiming(
      "2026-11-02",
      { startTime: "22:00:00", endTime: "06:00:00" },
      "Asia/Jakarta",
      new Date("2026-11-02T15:00:00Z"),
    );
    expect(r.scheduledEndAt.toISOString()).toBe("2026-11-02T23:00:00.000Z");
    expect((r.scheduledEndAt - r.scheduledStartAt) / 3600000).toBe(8);
  });
});
