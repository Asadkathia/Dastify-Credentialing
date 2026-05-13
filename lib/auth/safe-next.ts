/**
 * Validates a post-auth `next` redirect target.
 *
 * Open-redirect prevention: only accept same-origin, relative paths. An
 * attacker who controls `next` could otherwise land users on an external
 * lookalike of the portal after a successful sign-in.
 *
 * Rules:
 * - must be a string starting with a single "/"
 * - must not start with "//" (protocol-relative URL → off-site)
 * - must not start with "/\" (some clients normalize backslashes to "/")
 * - must not contain a backslash or control characters (incl. CR/LF) anywhere
 *
 * Returns the input when safe, otherwise `fallback`.
 */
export function safeNextPath(input: unknown, fallback = "/"): string {
  if (typeof input !== "string" || input.length === 0) return fallback;
  if (input[0] !== "/") return fallback;
  if (input.length > 1 && (input[1] === "/" || input[1] === "\\")) return fallback;
  if (input.includes("\\")) return fallback;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  return input;
}
