export const INTERNAL_AUTH_DOMAIN = "users.bitewise.local";

export function usernameToInternalEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${INTERNAL_AUTH_DOMAIN}`;
}

export function isInternalAuthEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.trim().toLowerCase().endsWith(`@${INTERNAL_AUTH_DOMAIN}`);
}
