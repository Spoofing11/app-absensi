export const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

export function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidUsername(value) {
  const normalized = normalizeUsername(value);
  return normalized.length >= 3 && normalized.length <= 50 && USERNAME_PATTERN.test(normalized);
}
