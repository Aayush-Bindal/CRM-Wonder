import { describe, expect, test } from 'bun:test';
import { normalizeImportedPhone, parseLeadsCsv } from './importLeads';

const HEADER = 'Full Name,Phone,Preferred Property,Status,Budget';

describe('normalizeImportedPhone', () => {
  test('keeps the last 10 digits of a country-coded number', () => {
    expect(normalizeImportedPhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizeImportedPhone('0091-98765-43210')).toBe('9876543210');
  });

  test('leaves short numbers alone so validation can reject them', () => {
    expect(normalizeImportedPhone('12345')).toBe('12345');
  });
});

describe('parseLeadsCsv', () => {
  test('normalizes +91 phones and quotes a comma-containing property', () => {
    const preview = parseLeadsCsv(
      `${HEADER}\nOld Lead Alpha,+91 98765 43210,"3BHK, Marina Residences",Closed Won,₹2.2 Cr`,
      new Set()
    );

    expect(preview.fileError).toBeUndefined();
    expect(preview.skipped).toEqual([]);
    expect(preview.valid).toEqual([
      {
        name: 'Old Lead Alpha',
        phone_1: '9876543210',
        mobile_2: null,
        address: null,
        dob: null,
        marriage_anniversary: null,
        preferred_property: '3BHK, Marina Residences',
        budget: '₹2.2 Cr',
        status: 'Closed Won',
        assigned_rep_id: null,
      },
    ]);
  });

  test('skips phones already in the CRM and repeats inside the file', () => {
    const preview = parseLeadsCsv(
      [
        HEADER,
        'Existing,+91 98765 43210,3BHK Marina,New,',
        'Fresh,9876500001,2BHK Lakeview,Contacted,',
        'Fresh Again,9876500001,2BHK Lakeview,New,',
      ].join('\n'),
      new Set(['9876543210'])
    );

    expect(preview.valid.map((row) => row.name)).toEqual(['Fresh']);
    expect(preview.skipped).toEqual([
      { rowNumber: 2, reason: 'Duplicate phone 9876543210 — already exists in the CRM.' },
      { rowNumber: 4, reason: 'Duplicate phone 9876500001 — repeated in this file.' },
    ]);
  });

  test('rejects invalid primary phones and rows missing required fields', () => {
    const preview = parseLeadsCsv(
      [
        HEADER,
        'Bad Phone,12345,1BHK,New,',
        ',9876500002,2BHK,New,',
        'No Property,9876500003,,New,',
      ].join('\n'),
      new Set()
    );

    expect(preview.valid).toEqual([]);
    expect(preview.skipped.map((skip) => skip.rowNumber)).toEqual([2, 3, 4]);
    expect(preview.skipped[0].reason).toContain('Invalid primary phone');
    expect(preview.skipped[1].reason).toContain('name');
    expect(preview.skipped[2].reason).toContain('preferred property');
  });

  test('maps known statuses and falls back to New with a warning', () => {
    const preview = parseLeadsCsv(
      [
        HEADER,
        'A,9876500001,P1,site visit,',
        'B,9876500002,P2,Won,',
        'C,9876500003,P3,failed,',
        'D,9876500004,P4,',
        'E,9876500005,P5,dreaming,',
      ].join('\n'),
      new Set()
    );

    expect(preview.valid.map((row) => row.status)).toEqual([
      'Site Visit',
      'Closed Won',
      'Closed Lost',
      'New',
      'New',
    ]);
    expect(preview.warnings).toEqual([
      { rowNumber: 6, message: 'Unknown status "dreaming" — imported as New.' },
    ]);
  });

  test('converts D/M/YYYY dates and drops impossible ones', () => {
    const preview = parseLeadsCsv(
      ['Full Name,Phone,Preferred Property,DOB,Marriage Anniversary', 'A,9876500001,P1,5/3/1988,31/04/2004'].join(
        '\n'
      ),
      new Set()
    );

    expect(preview.valid[0].dob).toBe('1988-03-05');
    expect(preview.valid[0].marriage_anniversary).toBeNull();
    expect(preview.warnings).toEqual([
      {
        rowNumber: 2,
        message: 'Marriage anniversary "31/04/2004" is not a valid date — dropped.',
      },
    ]);
  });

  test('reports a missing required column instead of importing anything', () => {
    const preview = parseLeadsCsv('Name,Budget\nA,₹1 Cr', new Set());

    expect(preview.valid).toEqual([]);
    expect(preview.fileError).toBe('CSV is missing required column(s): Phone, Preferred Property.');
  });
});
