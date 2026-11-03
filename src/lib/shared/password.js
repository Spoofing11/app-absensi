export const PASSWORD_HINT =
  "Min. 12 karakter: huruf besar (A–Z), huruf kecil (a–z), angka (0–9), dan simbol (!@#).";
export function passwordError(value) {
  if (typeof value !== "string" || value.length < 12)
    return "Password minimal 12 karakter.";
  if (value.length > 128) return "Password maksimal 128 karakter.";
  if (!/[A-Z]/.test(value))
    return "Password harus mengandung huruf besar (A–Z).";
  if (!/[a-z]/.test(value))
    return "Password harus mengandung huruf kecil (a–z).";
  if (!/[0-9]/.test(value)) return "Password harus mengandung angka (0–9).";
  if (!/[^A-Za-z0-9\s]/.test(value))
    return "Password harus mengandung simbol, misalnya !@#.";
  return "";
}
