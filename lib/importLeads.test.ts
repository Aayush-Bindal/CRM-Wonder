import { describe, expect, test } from 'bun:test';
import { parseLeadsCsv } from './importLeads';
import {
  matchesPropertyType,
  normalizePreferredProperty,
  normalizePropertyType,
  normalizeTenDigitPhone,
} from './utils';

const HEADER = 'flat_size,full_name,phone,email';

describe('normalizeTenDigitPhone', () => {
  test('keeps the last 10 digits of a country-coded number', () => {
    expect(normalizeTenDigitPhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizeTenDigitPhone('0091-98765-43210')).toBe('9876543210');
  });

  test('drops the sheet’s p: marker', () => {
    expect(normalizeTenDigitPhone('p:9876543210')).toBe('9876543210');
  });

  test('leaves short numbers alone so validation can reject them', () => {
    expect(normalizeTenDigitPhone('12345')).toBe('12345');
  });
});

describe('parseLeadsCsv', () => {
  test('imports the intake sheet row and ignores the email column', () => {
    const preview = parseLeadsCsv(
      `${HEADER}\n2BHK,"Sharma, Anil",p:+91 98765 43210,anil@example.com`,
      new Set()
    );

    expect(preview.fileError).toBeUndefined();
    expect(preview.skipped).toEqual([]);
    expect(preview.valid).toEqual([
      {
        name: 'Sharma, Anil',
        phone_1: '9876543210',
        preferred_property: '2BHK',
        status: 'Imported',
      },
    ]);
  });

  test('canonicalises sheet spellings of flat_size', () => {
    const preview = parseLeadsCsv(
      [
        HEADER,
        '4_bhk,Arvind,p:9876500011,',
        '1 bhk,Savita,p:9876500012,',
        'Penthouse,Shiv,p:9876500013,',
      ].join('\n'),
      new Set()
    );

    expect(preview.valid.map((row) => row.preferred_property)).toEqual([
      '4BHK',
      '1BHK',
      'Penthouse',
    ]);
  });

  test('keeps flat_size as the property and defaults a blank one', () => {
    const preview = parseLeadsCsv(
      [HEADER, '3BHK,With Size,p:9876500001,', ',No Size,p:9876500002,'].join('\n'),
      new Set()
    );

    expect(preview.valid.map((row) => row.preferred_property)).toEqual(['3BHK', 'Not specified']);
  });

  test('ignores extra columns', () => {
    const preview = parseLeadsCsv(
      `${HEADER},budget,status\nStudio,Old Lead,p:9876500003,old@example.com,₹1 Cr,Won`,
      new Set()
    );

    expect(preview.valid).toEqual([
      {
        name: 'Old Lead',
        phone_1: '9876500003',
        preferred_property: 'Studio',
        status: 'Imported',
      },
    ]);
  });

  test('skips phones already in the CRM and repeats inside the file', () => {
    const preview = parseLeadsCsv(
      [
        HEADER,
        '2BHK,Existing,p:+91 98765 43210,existing@example.com',
        '2BHK,Fresh,p:9876500004,',
        '2BHK,Fresh Again,p:9876500004,fresh@example.com',
      ].join('\n'),
      new Set(['9876543210'])
    );

    expect(preview.valid.map((row) => row.name)).toEqual(['Fresh']);
    expect(preview.skipped).toEqual([
      { rowNumber: 2, reason: 'Duplicate phone 9876543210 — already exists in the CRM.' },
      { rowNumber: 4, reason: 'Duplicate phone 9876500004 — repeated in this file.' },
    ]);
  });

  test('rejects invalid phones and rows missing full_name or phone', () => {
    const preview = parseLeadsCsv(
      [
        HEADER,
        '2BHK,Bad Phone,p:12345,bad@example.com',
        '2BHK,,p:9876500005,named@example.com',
        '2BHK,No Phone,,x@example.com',
      ].join('\n'),
      new Set()
    );

    expect(preview.valid).toEqual([]);
    expect(preview.skipped.map((skip) => skip.rowNumber)).toEqual([2, 3, 4]);
    expect(preview.skipped[0].reason).toContain('Invalid primary phone');
    expect(preview.skipped[1].reason).toContain('full_name');
    expect(preview.skipped[2].reason).toContain('phone');
  });

  test('reports a missing required column and the expected format', () => {
    const preview = parseLeadsCsv('full_name,email\nA,a@example.com', new Set());

    expect(preview.valid).toEqual([]);
    expect(preview.fileError).toBe(
      'CSV is missing required column(s): phone. Expected: flat_size, full_name, phone, email.'
    );
  });

  test('reports an empty file', () => {
    const preview = parseLeadsCsv(HEADER, new Set());

    expect(preview.valid).toEqual([]);
    expect(preview.fileError).toBe('The CSV has no data rows.');
  });
});

describe('property type identity', () => {
  test('normalizes sheet spellings onto the canonical option', () => {
    expect(normalizePropertyType('4_bhk')).toBe('4BHK');
    expect(normalizePropertyType('3 BHK')).toBe('3BHK');
    expect(normalizePropertyType('studio')).toBe('Studio');
    expect(normalizePropertyType('Penthouse')).toBe('Penthouse');
  });

  test('rewrites stored labels to the canonical spelling, per token', () => {
    expect(normalizePreferredProperty('4_bhk')).toBe('4BHK');
    expect(normalizePreferredProperty('Studio, 1BHK, 3BHK')).toBe('Studio, 1BHK, 3BHK');
    expect(normalizePreferredProperty('3_bhk, Marina Residences')).toBe('3BHK, Marina Residences');
    expect(normalizePreferredProperty('Penthouse')).toBe('Penthouse');
  });

  test('matches stored leads regardless of how the type was written', () => {
    expect(matchesPropertyType('4_bhk', '4BHK')).toBe(true);
    expect(matchesPropertyType('Studio, 1BHK, 3BHK', '1BHK')).toBe(true);
    expect(matchesPropertyType('3BHK, Marina Residences', '3BHK')).toBe(true);
    expect(matchesPropertyType('2BHK', '3BHK')).toBe(false);
  });
});
