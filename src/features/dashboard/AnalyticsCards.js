"use client";
import { Line, LineChart, ResponsiveContainer } from "recharts";
const cards = [
  ["total", "Total Pengguna", "#7b6049"],
  ["entered", "Sudah Masuk", "#43765a"],
  ["pending", "Belum Absen", "#a77a30"],
  ["leave", "Izin", "#527794"],
  ["sick", "Sakit", "#9d6b81"],
  ["unexcused", "Tanpa Keterangan", "#a44e46"],
  ["late", "Terlambat", "#b42318"],
];
export default function AnalyticsCards({ totals, trend, date }) {
  return (
    <div className="stats-grid analytics-spark-cards">
      {cards.map(([key, label, color]) => (
        <article
          className={`stat-card analytics-spark-card analytics-${key}`}
          key={key}
        >
          <span className="stat-label">{label}</span>
          <strong className={key === "late" ? "attendance-late" : undefined}>
            {totals[key]}
          </strong>
          <small>
            {key === "late" ? "pengguna dari yang sudah masuk" : "pengguna"}
          </small>
          <div className="analytics-sparkline" aria-hidden="true">
            <ResponsiveContainer width="100%" height={48} minWidth={0}>
              <LineChart data={trend}>
                <Line
                  type="linear"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <small>Tren 7 hari s.d. {date}</small>
        </article>
      ))}
    </div>
  );
}
