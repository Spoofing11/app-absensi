export function validWorkDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= "2000-01-01" &&
    value <= "2100-12-31"
  );
}

export function assignmentDateLabel(value) {
  return value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "full",
        timeZone: "UTC",
      }).format(new Date(`${value}T00:00:00Z`))
    : "Arsip penempatan lama";
}
