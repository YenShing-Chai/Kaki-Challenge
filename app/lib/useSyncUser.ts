/**
 * Legacy Clerk shim. Sign-up now creates the User row directly inside
 * /auth/signup, so this hook is a no-op kept only so existing callers don't
 * have to be edited. Safe to delete later.
 */
export function useSyncUser(): void {
  // intentionally empty
}
