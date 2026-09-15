'use client';

import React, { useState, useMemo } from 'react';
import { useCRM } from '@/lib/crmContext';
import { Lead, LeadStatus } from '@/lib/types';
import { Search, Phone, Home, MessageSquare, ChevronRight } from 'lucide-react';

interface MyLeadsViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenQuickAdd?: () => void;
}

const STATUS_FILTERS: Array<LeadStatus | 'All'> = [
  'All',
  'New',
  'Contacted',
  'Site Visit',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
];

export default function MyLeadsView({
  onSelectLead,
}: MyLeadsViewProps) {
  const { visibleLeads, currentUser } = useCRM();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus | 'All'>('All');

  // Filter leads based on search & status
  const filteredLeads = useMemo(() => {
    return visibleLeads.filter((lead) => {
      const matchesStatus =
        selectedStatus === 'All' || lead.status === selectedStatus;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        lead.phone_1.toLowerCase().includes(q) ||
        (lead.mobile_2 && lead.mobile_2.toLowerCase().includes(q)) ||
        lead.preferred_property.toLowerCase().includes(q) ||
        (lead.address && lead.address.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [visibleLeads, searchQuery, selectedStatus]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="bg-[#efefef] p-4 sm:p-6 rounded-lg border border-[#e8e8e8]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#ff682c]" />
              <span className="text-xs font-mono text-[#828282] uppercase tracking-wider">
                Assigned Portfolio
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-normal text-[#202020] tracking-tight">
              My Leads ({visibleLeads.length})
            </h1>
            <p className="text-xs text-[#4d4d4d] mt-0.5">
              Your active prospects, deal stages, and property inquiries.
            </p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="mt-4 pt-3 border-t border-[#e0e0e0] space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#828282] absolute left-3 top-2.5" />
            <input
              id="search-my-leads-input"
              type="text"
              placeholder="Search by client name, phone, or property..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
            />
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                id={`filter-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setSelectedStatus(status)}
                className={`px-2.5 py-1 text-xs font-mono rounded-full whitespace-nowrap transition-colors ${
                  selectedStatus === status
                    ? 'bg-[#202020] text-white'
                    : 'bg-white text-[#4d4d4d] hover:bg-[#e4e4e4] border border-[#e8e8e8]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#e8e8e8] rounded-lg">
          <p className="text-sm font-normal text-[#202020]">No leads match your filter.</p>
          <p className="text-xs text-[#828282] mt-1">
            Try adjusting your search criteria or add a new prospect.
          </p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-2.5">
          {filteredLeads.map((lead) => {
            const cleanPhone = lead.phone_1.replace(/[^0-9+]/g, '');

            return (
              <div
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className="bg-white border border-[#e8e8e8] hover:border-[#202020] rounded-lg p-3.5 sm:p-4 transition-all cursor-pointer group shadow-sm hover:shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#efefef] text-[#202020]">
                        {lead.status}
                      </span>
                      {lead.budget && (
                        <span className="text-[11px] font-mono text-[#816729]">
                          {lead.budget}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-[#202020] group-hover:text-[#ff682c] transition-colors truncate">
                        {lead.name}
                      </h3>
                      <span className="text-xs font-mono text-[#828282] group-hover:text-[#ff682c] flex items-center gap-0.5 sm:hidden shrink-0">
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#4d4d4d]">
                      <span className="flex items-center gap-1 font-mono text-[#202020] truncate max-w-[220px] sm:max-w-none">
                        <Home className="w-3.5 h-3.5 text-[#ff682c] shrink-0" />
                        <span className="truncate">{lead.preferred_property}</span>
                      </span>
                      <span className="font-mono text-[#828282] text-[11px] sm:text-xs">
                        {lead.phone_1}
                      </span>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div
                    className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t border-[#f0f0f0] sm:border-t-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      id={`call-lead-${lead.id}`}
                      href={`tel:${cleanPhone}`}
                      title="Direct Call"
                      className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors flex items-center justify-center gap-1.5 rounded"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#ff682c]" />
                      <span>Call</span>
                    </a>

                    <a
                      id={`whatsapp-lead-${lead.id}`}
                      href={`https://wa.me/${cleanPhone.replace('+', '')}?text=Hi%20${encodeURIComponent(
                        lead.name
                      )},%20following%20up%20from%20Wonder%20Real%20Estate.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp Chat"
                      className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 bg-white text-[#202020] border border-[#d8d8d8] text-xs font-medium hover:bg-[#efefef] transition-colors flex items-center justify-center gap-1.5 rounded"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                      <span>Chat</span>
                    </a>

                    <button
                      onClick={() => onSelectLead(lead)}
                      title="View Details"
                      className="hidden sm:flex p-1.5 text-[#828282] hover:text-[#202020] transition-colors rounded hover:bg-[#efefef]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
