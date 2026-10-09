const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function isSafeRedirectPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\") &&
    !CONTROL_CHARS.test(value)
  );
}

export function safeRedirectPath(value: unknown, fallback = "/"): string {
  return isSafeRedirectPath(value) ? value : fallback;
}
