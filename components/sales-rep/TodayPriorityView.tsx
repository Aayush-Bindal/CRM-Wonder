'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crmContext';
import { Lead } from '@/lib/types';
import { getTodayDateStr } from '@/lib/utils';
import {
  Phone,
  MessageSquare,
  CheckCircle2,
  Home,
  Check,
  RotateCcw,
  ChevronRight,
  FileText,
} from 'lucide-react';

interface TodayPriorityViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenQuickAdd?: () => void;
}

export default function TodayPriorityView({
  onSelectLead,
}: TodayPriorityViewProps) {
  const { visibleFollowups, visibleLeads, completeFollowup, rescheduleFollowup } = useCRM();

  const todayStr = getTodayDateStr();
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [activeRescheduleId, setActiveRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [quickResolutionNote, setQuickResolutionNote] = useState('');
  const [activeCompleteId, setActiveCompleteId] = useState<string | null>(null);

  // Filter followups for today
  const todayFollowups = visibleFollowups.filter((f) => f.followup_date === todayStr);

  const pendingFollowups = todayFollowups.filter((f) => f.status === 'Pending');
  const completedFollowups = todayFollowups.filter((f) => f.status === 'Completed');

  const displayedFollowups = todayFollowups.filter((f) => {
    if (filter === 'pending') return f.status === 'Pending';
    if (filter === 'completed') return f.status === 'Completed';
    return true;
  });

  const handleComplete = async (fupId: string) => {
    await completeFollowup(fupId, quickResolutionNote);
    setActiveCompleteId(null);
    setQuickResolutionNote('');
  };

  const handleReschedule = async (fupId: string) => {
    if (!newDate) return;
    await rescheduleFollowup(fupId, newDate);
    setActiveRescheduleId(null);
    setNewDate('');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mobile-optimized Header Banner */}
      <div className="bg-[#efefef] p-4 sm:p-6 rounded-lg border border-[#e8e8e8]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#ff682c]" />
              <span className="text-xs font-mono text-[#828282] uppercase tracking-wider">
                Daily Focus · {todayStr}
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-normal text-[#202020] tracking-tight">
              Today’s Priority
            </h1>
            <p className="text-xs text-[#4d4d4d] mt-0.5">
              Scheduled client follow-ups, calls, and site visits queued for today.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 bg-white rounded border border-[#e8e8e8] text-center">
              <span className="block text-lg sm:text-xl font-mono font-bold text-[#ff682c]">
                {pendingFollowups.length}
              </span>
              <span className="text-[10px] font-mono text-[#828282] uppercase">
                Pending
              </span>
            </div>
            <div className="flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 bg-white rounded border border-[#e8e8e8] text-center">
              <span className="block text-lg sm:text-xl font-mono font-bold text-emerald-600">
                {completedFollowups.length}
              </span>
              <span className="text-[10px] font-mono text-[#828282] uppercase">
                Completed
              </span>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="mt-4 pt-3 border-t border-[#e0e0e0] flex items-center gap-1.5 overflow-x-auto">
          <button
            id="filter-priority-pending"
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 text-xs font-mono rounded-full whitespace-nowrap transition-colors ${
              filter === 'pending'
                ? 'bg-[#202020] text-white'
                : 'bg-white text-[#4d4d4d] hover:bg-[#e4e4e4] border border-[#e8e8e8]'
            }`}
          >
            Pending ({pendingFollowups.length})
          </button>
          <button
            id="filter-priority-completed"
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 text-xs font-mono rounded-full whitespace-nowrap transition-colors ${
              filter === 'completed'
                ? 'bg-[#202020] text-white'
                : 'bg-white text-[#4d4d4d] hover:bg-[#e4e4e4] border border-[#e8e8e8]'
            }`}
          >
            Completed ({completedFollowups.length})
          </button>
          <button
            id="filter-priority-all"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-mono rounded-full whitespace-nowrap transition-colors ${
              filter === 'all'
                ? 'bg-[#202020] text-white'
                : 'bg-white text-[#4d4d4d] hover:bg-[#e4e4e4] border border-[#e8e8e8]'
            }`}
          >
            All Today ({todayFollowups.length})
          </button>
        </div>
      </div>

      {/* Priority Cards List (Mobile-Optimized Touch Cards) */}
      {displayedFollowups.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white border border-[#e8e8e8] rounded-lg">
          <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-base sm:text-lg font-normal text-[#202020]">
            {filter === 'pending'
              ? 'All caught up! No pending follow-ups for today.'
              : 'No follow-ups found for this filter.'}
          </h3>
          <p className="text-xs text-[#828282] mt-1 max-w-sm mx-auto">
            You can capture new inquiries using Add Lead or browse all your assigned leads in My Leads.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {displayedFollowups.map((item) => {
            const lead = visibleLeads.find((l) => l.id === item.lead_id);
            if (!lead) return null;
            const cleanPhone = lead.phone_1.replace(/[^0-9+]/g, '');

            return (
              <div
                key={item.id}
                className={`bg-white border rounded-lg p-3.5 sm:p-5 transition-all ${
                  item.status === 'Completed'
                    ? 'border-[#e8e8e8] opacity-75'
                    : 'border-[#d4d4d4] hover:border-[#202020] shadow-sm'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-2.5 sm:gap-3">
                  {/* Left Lead Info */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#efefef] text-[#202020]">
                        {lead.status}
                      </span>
                      {item.status === 'Completed' ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          COMPLETED
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#fff2ec] text-[#ff682c] font-semibold">
                          DUE TODAY
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => onSelectLead(lead)}
                        className="text-base sm:text-lg font-medium text-[#202020] hover:text-[#ff682c] transition-colors text-left truncate"
                      >
                        {lead.name}
                      </button>
                      <button
                        onClick={() => onSelectLead(lead)}
                        className="text-xs font-mono text-[#828282] hover:text-[#ff682c] flex items-center gap-0.5 sm:hidden shrink-0"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#4d4d4d]">
                      <span className="flex items-center gap-1 font-mono font-medium text-[#202020] truncate max-w-[200px] sm:max-w-none">
                        <Home className="w-3.5 h-3.5 text-[#ff682c] shrink-0" />
                        <span className="truncate">{lead.preferred_property}</span>
                      </span>
                      {lead.budget && (
                        <span className="font-mono text-[#816729] text-[11px] sm:text-xs">
                          {lead.budget}
                        </span>
                      )}
                    </div>

                    {/* Shortened note preview that expands into details drawer */}
                    {item.notes && (
                      <div
                        onClick={() => onSelectLead(lead)}
                        title="Click to view full lead details and timeline"
                        className="text-xs text-[#4d4d4d] bg-[#f8f8f8] hover:bg-[#f0f0f0] px-2.5 py-1.5 rounded mt-1.5 border border-[#e8e8e8] cursor-pointer flex items-center justify-between gap-2 transition-colors"
                      >
                        <span className="truncate">
                          <span className="font-mono font-semibold text-[#202020]">Goal: </span>
                          {item.notes}
                        </span>
                        <span className="text-[10px] font-mono text-[#ff682c] shrink-0 font-medium hidden sm:inline">
                          View details &rarr;
                        </span>
                      </div>
                    )}
                  </div>

                  {/* One-Tap Sales Rep Action Controls (Streamlined for Mobile) */}
                  <div className="flex items-center gap-1.5 sm:gap-2 pt-2 lg:pt-0 shrink-0 border-t border-[#f0f0f0] lg:border-t-0">
                    <a
                      id={`call-priority-${item.id}`}
                      href={`tel:${cleanPhone}`}
                      title="Call Lead Phone"
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors rounded"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#ff682c]" />
                      <span>Call</span>
                    </a>

                    <a
                      id={`whatsapp-priority-${item.id}`}
                      href={`https://wa.me/${cleanPhone.replace('+', '')}?text=Hi%20${encodeURIComponent(
                        lead.name
                      )},%20checking%20in%20from%20Wonder%20Real%20Estate.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Send WhatsApp"
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 bg-white text-[#202020] border border-[#d8d8d8] text-xs font-medium hover:bg-[#efefef] transition-colors rounded"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                      <span>Chat</span>
                    </a>

                    <button
                      id={`view-notes-priority-${item.id}`}
                      onClick={() => onSelectLead(lead)}
                      title="Open Lead Profile & Timeline"
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 bg-white text-[#202020] border border-[#d8d8d8] text-xs font-medium hover:bg-[#efefef] transition-colors rounded"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#828282]" />
                      <span>Details</span>
                    </button>

                    {item.status === 'Pending' ? (
                      <button
                        id={`complete-btn-priority-${item.id}`}
                        onClick={() => setActiveCompleteId(activeCompleteId === item.id ? null : item.id)}
                        className="px-3 py-2 bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1 rounded shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-emerald-700 flex items-center gap-1 px-2 py-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Done
                      </span>
                    )}

                    {item.status === 'Pending' && (
                      <button
                        id={`reschedule-btn-priority-${item.id}`}
                        onClick={() =>
                          setActiveRescheduleId(activeRescheduleId === item.id ? null : item.id)
                        }
                        title="Reschedule to future date"
                        className="p-2 text-[#828282] hover:text-[#202020] hover:bg-[#efefef] rounded transition-colors shrink-0"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Complete Box */}
                {activeCompleteId === item.id && (
                  <div className="mt-3 p-3 bg-[#f5f5f5] rounded border border-[#e8e8e8] flex flex-col sm:flex-row gap-2 animate-in fade-in">
                    <input
                      type="text"
                      placeholder="Resolution note (e.g. site visit booked)"
                      value={quickResolutionNote}
                      onChange={(e) => setQuickResolutionNote(e.target.value)}
                      className="flex-1 text-xs p-2 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleComplete(item.id)}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors rounded"
                      >
                        Confirm Done
                      </button>
                      <button
                        onClick={() => setActiveCompleteId(null)}
                        className="px-3 py-2 bg-white text-[#4d4d4d] border border-[#e8e8e8] text-xs hover:bg-[#efefef] rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Reschedule Box */}
                {activeRescheduleId === item.id && (
                  <div className="mt-3 p-3 bg-[#f5f5f5] rounded border border-[#e8e8e8] flex flex-col sm:flex-row gap-2 items-center animate-in fade-in">
                    <span className="text-xs font-mono text-[#4d4d4d] shrink-0">
                      New Date:
                    </span>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="text-xs p-2 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020] w-full sm:w-auto"
                    />
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        disabled={!newDate}
                        onClick={() => handleReschedule(item.id)}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors disabled:opacity-50 rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setActiveRescheduleId(null)}
                        className="px-3 py-2 bg-white text-[#4d4d4d] border border-[#e8e8e8] text-xs hover:bg-[#efefef] rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
