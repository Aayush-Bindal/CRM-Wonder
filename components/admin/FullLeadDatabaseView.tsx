'use client';

import React, { useState, useMemo } from 'react';
import { useCRM } from '@/lib/crmContext';
import { Lead } from '@/lib/types';
import {
  Search,
  Download,
  Home,
  Gift,
  ChevronRight,
  ArrowRightLeft,
  CheckCircle2,
} from 'lucide-react';

interface FullLeadDatabaseViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenQuickAdd?: () => void;
}

export default function FullLeadDatabaseView({
  onSelectLead,
}: FullLeadDatabaseViewProps) {
  const { leads, profiles, reassignLead } = useCRM();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepFilter, setSelectedRepFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [reassigningLead, setReassigningLead] = useState<Lead | null>(null);
  const [targetRepId, setTargetRepId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const reps = profiles.filter((p) => p.role === 'Sales_Rep');

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (selectedRepFilter !== 'all' && lead.assigned_rep_id !== selectedRepFilter) {
        return false;
      }
      if (selectedStatusFilter !== 'all' && lead.status !== selectedStatusFilter) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        lead.name.toLowerCase().includes(q) ||
        lead.phone_1.toLowerCase().includes(q) ||
        (lead.mobile_2 && lead.mobile_2.toLowerCase().includes(q)) ||
        lead.preferred_property.toLowerCase().includes(q) ||
        (lead.address && lead.address.toLowerCase().includes(q))
      );
    });
  }, [leads, selectedRepFilter, selectedStatusFilter, searchQuery]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Lead ID',
      'Full Name',
      'Primary Phone',
      'Secondary Mobile',
      'Preferred Property',
      'Budget',
      'Status',
      'Assigned Rep',
      'DOB',
      'Marriage Anniversary',
      'Address',
      'Created At',
    ];

    const rows = filteredLeads.map((lead) => {
      const rep = profiles.find((p) => p.id === lead.assigned_rep_id);
      return [
        lead.id,
        `"${lead.name.replace(/"/g, '""')}"`,
        `"${lead.phone_1}"`,
        `"${lead.mobile_2 || ''}"`,
        `"${lead.preferred_property.replace(/"/g, '""')}"`,
        `"${lead.budget || ''}"`,
        lead.status,
        `"${rep?.full_name || 'Unassigned'}"`,
        lead.dob || '',
        lead.marriage_anniversary || '',
        `"${(lead.address || '').replace(/"/g, '""')}"`,
        lead.created_at,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `real_estate_leads_export_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reassignment Submission
  const handleConfirmReassign = async () => {
    if (!reassigningLead || !targetRepId) return;
    await reassignLead(reassigningLead.id, targetRepId);
    const newRep = profiles.find((p) => p.id === targetRepId);
    setFeedback(`Lead ${reassigningLead.name} successfully reassigned to ${newRep?.full_name}!`);
    setReassigningLead(null);
    setTargetRepId('');
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#efefef] p-6 rounded-lg border border-[#e8e8e8]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-[#ff682c]" />
              <span className="text-xs font-mono text-[#828282] uppercase tracking-wider">
                Lead Management
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-normal text-[#202020] tracking-tight">
              All Leads Directory ({leads.length})
            </h1>
            <p className="text-xs sm:text-sm text-[#4d4d4d] mt-1">
              Centralized registry of all property inquiries. Search prospects, manage sales assignments, and export records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="export-leads-csv-btn"
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-white hover:bg-[#f5f5f5] text-[#202020] text-xs font-mono border border-[#d8d8d8] rounded flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#ff682c]" />
              <span>Export to CSV ({filteredLeads.length})</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Search & Filters */}
        <div className="mt-5 pt-4 border-t border-[#e0e0e0] grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 text-[#828282] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search leads, phone, property..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
            />
          </div>

          <select
            value={selectedRepFilter}
            onChange={(e) => setSelectedRepFilter(e.target.value)}
            className="text-xs p-2 bg-white border border-[#e8e8e8] rounded text-[#202020] font-mono"
          >
            <option value="all">All Assigned Sales Reps</option>
            {reps.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.full_name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="text-xs p-2 bg-white border border-[#e8e8e8] rounded text-[#202020] font-mono"
          >
            <option value="all">All Pipeline Stages</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Site Visit">Site Visit</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Closed Won">Closed Won</option>
            <option value="Closed Lost">Closed Lost</option>
          </select>
        </div>
      </div>

      {/* Database Table */}
      <div className="bg-white border border-[#e8e8e8] rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f5f5f5] text-[#828282] font-mono uppercase tracking-wider border-b border-[#e8e8e8]">
              <tr>
                <th className="px-4 py-3">Lead Name</th>
                <th className="px-4 py-3">Preferred Property</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Assigned Rep</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e8e8]">
              {filteredLeads.map((lead) => {
                const rep = profiles.find((p) => p.id === lead.assigned_rep_id);

                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-[#fafafa] transition-colors cursor-pointer group"
                    onClick={() => onSelectLead(lead)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#202020] block group-hover:text-[#ff682c] transition-colors">
                        {lead.name}
                      </span>
                      {lead.dob && (
                        <span className="text-[10px] text-[#828282] font-mono flex items-center gap-1 mt-0.5">
                          <Gift className="w-2.5 h-2.5 text-[#ff682c]" /> DOB: {lead.dob}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-[#202020] font-medium flex items-center gap-1 font-mono">
                        <Home className="w-3 h-3 text-[#ff682c]" />
                        {lead.preferred_property}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-mono text-[#4d4d4d]">
                      <div>{lead.phone_1}</div>
                      {lead.mobile_2 && (
                        <div className="text-[10px] text-[#828282]">{lead.mobile_2}</div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#efefef] text-[#202020]">
                        {lead.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-mono text-[#816729]">
                      {lead.budget || '—'}
                    </td>

                    <td className="px-4 py-3 font-mono text-[#202020]">
                      <span className="font-medium">{rep?.full_name || 'Unassigned'}</span>
                    </td>

                    <td
                      className="px-4 py-3 text-right space-x-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        id={`reassign-lead-${lead.id}`}
                        onClick={() => {
                          setReassigningLead(lead);
                          setTargetRepId(lead.assigned_rep_id);
                        }}
                        className="px-2.5 py-1 bg-[#efefef] hover:bg-[#e4e4e4] text-[#202020] font-mono text-[11px] rounded transition-colors inline-flex items-center gap-1"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-[#ff682c]" />
                        <span>Reassign</span>
                      </button>

                      <button
                        onClick={() => onSelectLead(lead)}
                        className="p-1 text-[#828282] hover:text-[#202020] transition-colors inline-block"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reassign Lead Modal */}
      {reassigningLead && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-lg shadow-2xl border border-[#e8e8e8] animate-in zoom-in-95">
            <h3 className="text-lg font-normal text-[#202020] tracking-tight mb-1">
              Reassign Lead: {reassigningLead.name}
            </h3>
            <p className="text-xs text-[#828282] mb-4 font-mono">
              Property: {reassigningLead.preferred_property}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono uppercase text-[#4d4d4d] mb-1">
                  Select New Assigned Representative
                </label>
                <select
                  value={targetRepId}
                  onChange={(e) => setTargetRepId(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] font-mono"
                >
                  {reps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.full_name} ({rep.email})
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-[#828282] bg-[#f5f5f5] p-2.5 rounded border border-[#e8e8e8]">
                Note: Reassigning will automatically transfer all pending follow-up schedules for this lead to the newly assigned representative.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-[#e8e8e8] flex items-center justify-end gap-2">
              <button
                onClick={() => setReassigningLead(null)}
                className="px-3 py-1.5 text-xs text-[#4d4d4d] hover:bg-[#efefef] rounded font-mono"
              >
                Cancel
              </button>
              <button
                id="confirm-reassign-btn"
                onClick={handleConfirmReassign}
                className="px-4 py-2 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
