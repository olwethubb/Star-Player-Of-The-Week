/** Thrown deliberately at app-level validation sites (insufficient balance, self-vote, ...).
 * Its message is safe to show to the user, unlike a raw Firebase error. */
export class AppValidationError extends Error {
  readonly isAppError = true;
}

/** Never surfaces raw Firebase error text (codes like "auth/..." or "Missing or
 * insufficient permissions") to end users — only the app's own thrown validation
 * errors, or a generic fallback. */
export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof AppValidationError) return err.message;
  return fallback;
}
