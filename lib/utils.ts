import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PREFERRED_PROPERTY_TYPES } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Shared by the admin API routes (server) and the account forms (client), so
// the enforced floor and the advertised one cannot drift apart.
export const MIN_PASSWORD_LENGTH = 8;

export const MAX_PHONE_DIGITS = 10;

export const normalizePhoneInput = (value: string): string =>
  value.replace(/\D/g, '').slice(0, MAX_PHONE_DIGITS);

export const isPhoneNumber = (value: string): boolean =>
  new RegExp(`^\\d{${MAX_PHONE_DIGITS}}$`).test(value);

// "+91 98765 43210", "p:9876543210" and "098765 43210" are the same person:
// every format carries the national number as its last 10 digits. Used where a
// phone has to identify a lead (dedupe, CSV import), not where it is displayed.
export const normalizeTenDigitPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.length > MAX_PHONE_DIGITS ? digits.slice(-MAX_PHONE_DIGITS) : digits;
};

// Local calendar formatting, YYYY-MM-DD.
//
// Do not switch this to toISOString(): that converts to UTC first, so in
// UTC+5:30 the returned day is still yesterday's until 05:30 local, which hides
// every follow-up scheduled for the actual current day and shifts the default
// follow-up date by one.
export const toDateStr = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

export const getTodayDateStr = (): string => toDateStr(new Date());

export const getRelativeDateStr = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toDateStr(d);
};

// Three or more past-due pending follow-ups flags a representative on the
// Admin screens as needing attention.
export const OVERDUE_ATTENTION_THRESHOLD = 3;

// Both dates are YYYY-MM-DD local calendar strings, so a lexicographic compare
// is a date compare. Parsing either through Date would reintroduce the UTC
// shift that getTodayDateStr() exists to avoid.
export const isFollowupDuePast = (
  followup: { status: string; followup_date: string },
  today = getTodayDateStr()
): boolean => followup.status === 'Pending' && followup.followup_date < today;

export const followupDaysPastDue = (
  followupDate: string,
  today = getTodayDateStr()
): number => {
  const due = Date.parse(`${followupDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return 0;
  return Math.max(0, Math.round((now - due) / 86_400_000));
};

// A lead can want more than one type ("2BHK, 3BHK") and imported sheets write
// the same demand with separators ("4_bhk") or with a longer phrase
// ("3BHK, Marina Residences"). Both sides are compacted before comparing, so a
// 4BHK filter matches every spelling, and a 2BHK filter never matches 3BHK.
const compactPropertyType = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

// Maps a sheet value onto the canonical option ("4_bhk" -> "4BHK"), so new
// imports are stored exactly like Add Lead stores them. Unrecognised values are
// kept as written rather than silently discarded.
export const normalizePropertyType = (raw: string): string => {
  const compact = compactPropertyType(raw);
  if (!compact) return raw.trim();
  return (
    PREFERRED_PROPERTY_TYPES.find((type) =>
      compact.startsWith(compactPropertyType(type))
    ) ?? raw.trim()
  );
};

export const matchesPropertyType = (
  preferredProperty: string,
  propertyType: string
): boolean => {
  const needle = compactPropertyType(propertyType);
  return preferredProperty
    .split(',')
    .some((token) => {
      const value = compactPropertyType(token);
      return value !== '' && value.startsWith(needle);
    });
};

// Spreadsheet clients evaluate a cell whose text starts with =, +, -, @, tab or
// CR as a formula, and CSV quoting does not neutralize it. Every exported field
// goes through this so a lead field cannot plant a formula in an admin's
// spreadsheet (CSV injection / CWE-1236).
export const escapeCsvField = (value: unknown): string => {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};
