import Papa from 'papaparse';
import { isPhoneNumber } from './utils';
import type { LeadImportRow, LeadStatus } from './types';

// Admins paste historical exports from several sources (their old CRM, a
// spreadsheet, a WhatsApp forward). Columns are matched by alias and every bad
// cell is either a row-level skip (identity data) or a dropped value with a
// warning (optional detail), never a silent corruption.

export interface ImportSkip {
  rowNumber: number;
  reason: string;
}

export interface ImportWarning {
  rowNumber: number;
  message: string;
}

export interface ImportPreview {
  valid: LeadImportRow[];
  skipped: ImportSkip[];
  warnings: ImportWarning[];
  fileError?: string;
}

// A header is a human label, not a schema key: strip the BOM Excel adds, fold
// case, and treat underscores/hyphens/spacing as equivalent separators.
const normalizeHeader = (header: string): string =>
  header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const COLUMN_ALIASES = {
  name: ['name', 'full name', 'client name', 'lead name', 'customer name'],
  phone_1: [
    'phone',
    'phone 1',
    'primary phone',
    'mobile',
    'mobile 1',
    'phone number',
    'contact number',
    'contact',
  ],
  mobile_2: ['phone 2', 'mobile 2', 'secondary mobile', 'alternate phone', 'alternate mobile'],
  preferred_property: ['preferred property', 'property', 'property interest', 'project', 'unit'],
  budget: ['budget', 'budget range'],
  address: ['address', 'residential address'],
  dob: ['dob', 'date of birth', 'birthday'],
  marriage_anniversary: ['marriage anniversary', 'anniversary', 'wedding anniversary'],
  status: ['status', 'stage', 'pipeline status'],
} as const;

type CanonicalColumn = keyof typeof COLUMN_ALIASES;
type ColumnMap = Partial<Record<CanonicalColumn, string>>;

const REQUIRED_COLUMNS: CanonicalColumn[] = ['name', 'phone_1', 'preferred_property'];

const REQUIRED_LABELS: Record<CanonicalColumn, string> = {
  name: 'Name',
  phone_1: 'Phone',
  mobile_2: 'Secondary Mobile',
  preferred_property: 'Preferred Property',
  budget: 'Budget',
  address: 'Address',
  dob: 'DOB',
  marriage_anniversary: 'Marriage Anniversary',
  status: 'Status',
};

// "+91 98765 43210" and "098765 43210" are the same person; only the national
// 10-digit part identifies a lead, so a longer number keeps its last 10 digits.
export const normalizeImportedPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const STATUS_ALIASES: Record<string, LeadStatus> = {
  new: 'New',
  contacted: 'Contacted',
  'site visit': 'Site Visit',
  sitevisit: 'Site Visit',
  negotiation: 'Negotiation',
  'closed won': 'Closed Won',
  won: 'Closed Won',
  success: 'Closed Won',
  'closed lost': 'Closed Lost',
  lost: 'Closed Lost',
  failed: 'Closed Lost',
};

const pad2 = (value: string): string => value.padStart(2, '0');

// Accepts the shapes Indian exports actually contain and returns a valid
// YYYY-MM-DD calendar date, or null when the value is not one. The round trip
// through Date.UTC rejects 2024-02-31 and 31/04/2024 instead of rolling them
// over into the next month.
const parseImportDate = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return null;

  let year: string;
  let month: string;
  let day: string;

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

  if (iso) {
    [, year, month, day] = iso;
  } else if (dmy) {
    [, day, month, year] = dmy;
  } else {
    return null;
  }

  const normalized = `${year}-${pad2(month)}-${pad2(day)}`;
  const utc = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== normalized) return null;
  return normalized;
};

export const parseLeadsCsv = (
  text: string,
  existingPhones: Set<string>
): ImportPreview => {
  const empty: ImportPreview = { valid: [], skipped: [], warnings: [] };

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  });

  const headers = parsed.meta.fields ?? [];
  const columns: ColumnMap = {};
  for (const canonical of Object.keys(COLUMN_ALIASES) as CanonicalColumn[]) {
    const alias = COLUMN_ALIASES[canonical].find((candidate) => headers.includes(candidate));
    if (alias) columns[canonical] = alias;
  }

  const missing = REQUIRED_COLUMNS.filter((column) => !columns[column]);
  if (missing.length > 0) {
    return {
      ...empty,
      fileError: `CSV is missing required column(s): ${missing
        .map((column) => REQUIRED_LABELS[column])
        .join(', ')}.`,
    };
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    return { ...empty, fileError: 'The CSV has no data rows.' };
  }

  const valid: LeadImportRow[] = [];
  const skipped: ImportSkip[] = [];
  const warnings: ImportWarning[] = [];
  const filePhones = new Set<string>();

  const cell = (row: Record<string, string>, column: CanonicalColumn): string => {
    const header = columns[column];
    const raw = header ? row[header] : '';
    return (raw ?? '').trim();
  };

  rows.forEach((row, index) => {
    // Data starts on line 2: line 1 is the header.
    const rowNumber = index + 2;

    const name = cell(row, 'name');
    const property = cell(row, 'preferred_property');

    if (!name) {
      skipped.push({ rowNumber, reason: 'Missing required field: name.' });
      return;
    }
    if (!property) {
      skipped.push({ rowNumber, reason: 'Missing required field: preferred property.' });
      return;
    }

    const rawPhone = cell(row, 'phone_1');
    const phone = normalizeImportedPhone(rawPhone);
    if (!isPhoneNumber(phone)) {
      skipped.push({
        rowNumber,
        reason: rawPhone
          ? `Invalid primary phone "${rawPhone}" — expected 10 digits.`
          : 'Missing required field: phone.',
      });
      return;
    }

    if (existingPhones.has(phone)) {
      skipped.push({ rowNumber, reason: `Duplicate phone ${phone} — already exists in the CRM.` });
      return;
    }
    if (filePhones.has(phone)) {
      skipped.push({ rowNumber, reason: `Duplicate phone ${phone} — repeated in this file.` });
      return;
    }
    filePhones.add(phone);

    // Optional values never reject a row: an import that drops a bad
    // anniversary date is still worth running, and the warning says which.
    let mobile2: string | null = null;
    const rawMobile2 = cell(row, 'mobile_2');
    if (rawMobile2) {
      const normalized = normalizeImportedPhone(rawMobile2);
      if (isPhoneNumber(normalized)) {
        mobile2 = normalized;
      } else {
        warnings.push({
          rowNumber,
          message: `Secondary mobile "${rawMobile2}" is not a 10-digit number — dropped.`,
        });
      }
    }

    const parseOptionalDate = (column: CanonicalColumn, label: string): string | null => {
      const raw = cell(row, column);
      if (!raw) return null;
      const parsedDate = parseImportDate(raw);
      if (!parsedDate) {
        warnings.push({
          rowNumber,
          message: `${label} "${raw}" is not a valid date — dropped.`,
        });
      }
      return parsedDate;
    };

    let status: LeadStatus = 'New';
    const rawStatus = cell(row, 'status');
    if (rawStatus) {
      const key = rawStatus.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
      const mapped = STATUS_ALIASES[key];
      if (mapped) {
        status = mapped;
      } else {
        warnings.push({
          rowNumber,
          message: `Unknown status "${rawStatus}" — imported as New.`,
        });
      }
    }

    valid.push({
      name,
      phone_1: phone,
      mobile_2: mobile2,
      address: cell(row, 'address') || null,
      dob: parseOptionalDate('dob', 'DOB'),
      marriage_anniversary: parseOptionalDate('marriage_anniversary', 'Marriage anniversary'),
      preferred_property: property,
      budget: cell(row, 'budget') || null,
      status,
      assigned_rep_id: null,
    });
  });

  return { valid, skipped, warnings };
};
