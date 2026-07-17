import { useAuth } from "@/contexts/AuthContext";

/**
 * Format a date/timestamp in the user's preferred timezone (from profiles.timezone).
 * Falls back to browser locale/tz when unset.
 */
export function useUserTimezone(): string | undefined {
  const { user } = useAuth();
  return (user as any)?.timezone || undefined;
}

export function formatInTz(
  value: string | number | Date | null | undefined,
  tz?: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function useFormatDate() {
  const tz = useUserTimezone();
  return (v: string | number | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
    formatInTz(v, tz, opts);
}

export const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];
