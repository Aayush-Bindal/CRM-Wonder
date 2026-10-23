import Papa from 'papaparse';
import { isPhoneNumber, normalizePropertyType, normalizeTenDigitPhone } from './utils';
import type { LeadImportRow } from './types';

// The import contract is the intake sheet's layout: flat_size, full_name,
// phone, email. Only the first three are read — the sheet carries an email
// column, but leads has nowhere to store it, so it is accepted and ignored.
export const IMPORT_COLUMNS = ['flat_size', 'full_name', 'phone', 'email'] as const;

// leads.preferred_property is NOT NULL, so a row whose flat_size cell is empty
// gets this placeholder instead of failing the whole import.
export const UNSPECIFIED_PROPERTY = 'Not specified';

export interface ImportSkip {
  rowNumber: number;
  reason: string;
}

export interface ImportPreview {
  valid: LeadImportRow[];
  skipped: ImportSkip[];
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
  // The intake sheet exports the property type as flat_size ("2BHK", "Studio").
  preferred_property: [
    'flat size',
    'flatsize',
    'flat type',
    'bhk',
    'preferred property',
    'property',
  ],
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
} as const;

type CanonicalColumn = keyof typeof COLUMN_ALIASES;
type ColumnMap = Partial<Record<CanonicalColumn, string>>;

const REQUIRED_COLUMNS: CanonicalColumn[] = ['name', 'phone_1'];

const COLUMN_LABELS: Record<CanonicalColumn, string> = {
  name: 'full_name',
  phone_1: 'phone',
  preferred_property: 'flat_size',
};

export const parseLeadsCsv = (
  text: string,
  existingPhones: Set<string>
): ImportPreview => {
  const empty: ImportPreview = { valid: [], skipped: [] };

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
        .map((column) => COLUMN_LABELS[column])
        .join(', ')}. Expected: ${IMPORT_COLUMNS.join(', ')}.`,
    };
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    return { ...empty, fileError: 'The CSV has no data rows.' };
  }

  const valid: LeadImportRow[] = [];
  const skipped: ImportSkip[] = [];
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
    if (!name) {
      skipped.push({ rowNumber, reason: 'Missing required field: full_name.' });
      return;
    }

    const rawPhone = cell(row, 'phone_1');
    const phone = normalizeTenDigitPhone(rawPhone);
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

    valid.push({
      name,
      phone_1: phone,
      preferred_property:
        normalizePropertyType(cell(row, 'preferred_property')) || UNSPECIFIED_PROPERTY,
      status: 'Imported',
    });
  });

  return { valid, skipped };
};
