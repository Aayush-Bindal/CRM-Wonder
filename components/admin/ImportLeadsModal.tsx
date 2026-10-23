'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crmContext';
import { parseLeadsCsv } from '@/lib/importLeads';
import { normalizeTenDigitPhone } from '@/lib/utils';
import type { ImportPreview } from '@/lib/importLeads';
import { AlertTriangle, CheckCircle2, FileUp, Upload, X } from 'lucide-react';

interface ImportLeadsModalProps {
  onClose: () => void;
}

const PREVIEW_ROWS = 8;

// Rendered only while open, so every piece of state below resets when the modal
// closes: a second import must never inherit the previous file's preview.
export default function ImportLeadsModal({ onClose }: ImportLeadsModalProps) {
  const { leads, importLeads } = useCRM();

  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setPreview(null);
    setReadError(null);
    setImportError(null);
    setResult(null);

    try {
      const text = await file.text();
      // Duplicate detection is against the phones already in the CRM, so the
      // parse sees the same normalized identity the table shows.
      const existingPhones = new Set(
        leads.map((lead) => normalizeTenDigitPhone(lead.phone_1)).filter(Boolean)
      );
      setPreview(parseLeadsCsv(text, existingPhones));
    } catch {
      setReadError('The selected file could not be read. Try choosing it again.');
    }
  };

  const handleImport = async () => {
    if (!preview || preview.valid.length === 0 || isImporting) return;

    setIsImporting(true);
    setImportError(null);
    const outcome = await importLeads(preview.valid);
    setIsImporting(false);

    if (!outcome.success) {
      setImportError(
        outcome.inserted > 0
          ? `${outcome.error} The ${outcome.inserted} lead(s) saved before the failure are already in the Lead Database.`
          : outcome.error || 'The import failed.'
      );
    }
    setResult({ inserted: outcome.inserted, skipped: preview.skipped.length });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full rounded-lg shadow-2xl border border-[#e8e8e8] animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 bg-[#efefef] border-b border-[#e8e8e8] rounded-t-lg px-5 py-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#828282]">
              Lead Management
            </span>
            <h3 className="text-lg font-normal text-[#202020] tracking-tight">
              Import Leads from CSV
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close import dialog"
            className="p-1 text-[#828282] hover:text-[#202020] hover:bg-[#e4e4e4] rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="import-leads-file-input"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                // Reset so selecting the same file again re-runs the parse.
                e.target.value = '';
                if (file) await handleFile(file);
              }}
            />
            <label
              htmlFor="import-leads-file-input"
              className="px-3.5 py-2 bg-[#202020] text-white text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer hover:bg-black transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-[#ff682c]" />
              <span>Choose CSV</span>
            </label>
            {fileName && (
              <span className="text-[11px] font-mono text-[#4d4d4d] truncate max-w-[16rem]">
                {fileName}
              </span>
            )}
          </div>

          {readError && (
            <p className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded border border-red-200">
              {readError}
            </p>
          )}

          {preview?.fileError && (
            <p className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded border border-red-200">
              {preview.fileError}
            </p>
          )}

          {preview && !preview.fileError && (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono">
                <span className="text-emerald-700">Ready: {preview.valid.length}</span>
                <span className="text-[#4d4d4d]">Skipped: {preview.skipped.length}</span>
              </div>

              {preview.valid.length > 0 && (
                <div className="border border-[#e8e8e8] rounded overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#f5f5f5] text-[#828282] font-mono uppercase tracking-wider">
                      <tr>
                        <th className="px-2.5 py-1.5">Flat Size</th>
                        <th className="px-2.5 py-1.5">Name</th>
                        <th className="px-2.5 py-1.5">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {preview.valid.slice(0, PREVIEW_ROWS).map((row) => (
                        <tr key={`${row.phone_1}-${row.name}`}>
                          <td className="px-2.5 py-1.5 font-mono text-[#202020]">
                            {row.preferred_property}
                          </td>
                          <td className="px-2.5 py-1.5 text-[#202020]">{row.name}</td>
                          <td className="px-2.5 py-1.5 font-mono text-[#4d4d4d]">{row.phone_1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.valid.length > PREVIEW_ROWS && (
                    <p className="px-2.5 py-1.5 text-[10px] font-mono text-[#828282] border-t border-[#f0f0f0]">
                      and {preview.valid.length - PREVIEW_ROWS} more
                    </p>
                  )}
                </div>
              )}

              {preview.skipped.length > 0 && (
                <div className="bg-[#f5f5f5] border border-[#e8e8e8] rounded p-2.5 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#828282]">
                    Skipped rows
                  </span>
                  {preview.skipped.slice(0, PREVIEW_ROWS).map((skip) => (
                    <p key={skip.rowNumber} className="text-[11px] text-[#4d4d4d]">
                      Row {skip.rowNumber} — {skip.reason}
                    </p>
                  ))}
                  {preview.skipped.length > PREVIEW_ROWS && (
                    <p className="text-[10px] font-mono text-[#828282]">
                      and {preview.skipped.length - PREVIEW_ROWS} more
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {importError && (
            <p className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded border border-red-200">
              {importError}
            </p>
          )}

          {result && !importError && (
            <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2.5 rounded border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Imported {result.inserted} leads. {result.skipped} skipped.
              </span>
            </p>
          )}

          <p className="text-[11px] text-[#828282] bg-[#f5f5f5] p-2.5 rounded border border-[#e8e8e8] flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#816729] shrink-0 mt-px" />
            <span>
              Expected columns: flat_size, full_name, phone, email. Email is ignored (the CRM has
              no email field for leads); any other column is ignored too. Imported leads arrive
              unassigned — assign them from the Lead Database — and carry the “Imported” stage,
              so they never read as fresh pipeline. A blank flat_size shows as “Not specified”.
            </span>
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#e8e8e8]">
          {result && !importError ? (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-[#4d4d4d] hover:bg-[#efefef] rounded font-mono"
              >
                Cancel
              </button>
              <button
                id="confirm-import-leads-btn"
                onClick={handleImport}
                disabled={
                  isImporting || !preview || Boolean(preview.fileError) || preview.valid.length === 0
                }
                className="px-4 py-2 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <FileUp className="w-3.5 h-3.5 text-[#ff682c]" />
                <span>
                  {isImporting
                    ? 'Importing…'
                    : `Import ${preview && !preview.fileError ? preview.valid.length : 0} Leads`}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
