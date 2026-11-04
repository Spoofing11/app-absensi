export const PASSWORD_LENGTH = 8;
export const PASSWORD_HINT = "Tepat 8 karakter. Boleh huruf saja, angka saja, atau campuran.";

export function passwordError(value) {
  if (typeof value !== "string" || value.length !== PASSWORD_LENGTH) {
    return "Password harus tepat 8 karakter.";
  }
  return "";
}
