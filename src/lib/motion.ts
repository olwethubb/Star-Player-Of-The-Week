/** True once, at call time — not reactive, since the reveal ceremony's timing is
 * decided the moment it starts and shouldn't jump mid-sequence if the OS setting
 * happens to change while it's running. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
