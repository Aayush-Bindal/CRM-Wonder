'use client';

import React, { useState, useMemo } from 'react';
import { useCRM } from '@/lib/crmContext';
import { Lead } from '@/lib/types';
import { getTodayDateStr, getRelativeDateStr, isFollowupDuePast, followupDaysPastDue, OVERDUE_ATTENTION_THRESHOLD } from '@/lib/utils';

interface TeamFollowupsViewProps {
  onSelectLead: (lead: Lead) => void;
}

export default function TeamFollowupsView({ onSelectLead }: TeamFollowupsViewProps) {
  const { followups, leads, profiles } = useCRM();

  const todayStr = getTodayDateStr();
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'all'>('today');

  const reps = profiles.filter((p) => p.role === 'Sales_Rep');

  // Filter followups
  const filteredFollowups = useMemo(() => {
    return followups.filter((f) => {
      // Rep filter
      if (selectedRepId !== 'all' && f.rep_id !== selectedRepId) return false;

      // Status filter
      if (selectedStatus === 'due_past') {
        if (!isFollowupDuePast(f, todayStr)) return false;
      } else if (selectedStatus !== 'all' && f.status !== selectedStatus) {
        return false;
      }

      // Date range filter. The "today" view keeps a pending item once its date
      // has passed: an overdue follow-up is still owed today.
      if (dateRange === 'today') {
        return f.status === 'Pending'
          ? f.followup_date <= todayStr
          : f.followup_date === todayStr;
      }
      if (dateRange === 'week') {
        const weekEnd = getRelativeDateStr(7);
        if (f.status === 'Pending' && f.followup_date < todayStr) return true;
        return f.followup_date >= todayStr && f.followup_date <= weekEnd;
      }

      return true;
    });
  }, [followups, selectedRepId, selectedStatus, dateRange, todayStr]);

  // Breakdown by Rep for Admin Oversight
  const repSummary = useMemo(() => {
    return reps.map((rep) => {
      const repFups = followups.filter((f) => f.rep_id === rep.id);
      const pending = repFups.filter(
        (f) => f.status === 'Pending' && f.followup_date === todayStr
      ).length;
      const duePast = repFups.filter((f) => isFollowupDuePast(f, todayStr)).length;
      const completed = repFups.filter(
        (f) => f.status === 'Completed' && f.followup_date === todayStr
      ).length;
      return { ...rep, todayPending: pending, duePast, todayCompleted: completed };
    });
  }, [reps, followups, todayStr]);

  const repsNeedingAttention = repSummary.filter(
    (rep) => rep.duePast >= OVERDUE_ATTENTION_THRESHOLD
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#efefef] p-6 rounded-lg border border-[#e8e8e8]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#ff682c]" />
              <span className="text-xs font-mono text-[#828282] uppercase tracking-wider">
                Follow-up Tracking
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-normal text-[#202020] tracking-tight">
              Team Follow-ups
            </h1>
            <p className="text-xs sm:text-sm text-[#4d4d4d] mt-1">
              Consolidated schedule of pending, overdue, and completed follow-ups across your sales team.
            </p>
          </div>
        </div>

        {/* Rep Today Load Matrix */}
        <div className="mt-6 pt-5 border-t border-[#e0e0e0]">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase text-[#828282]">
              Today&apos;s Follow-up Workload by Representative
            </span>
            <span
              className={`text-[10px] font-mono ${
                repsNeedingAttention.length > 0 ? 'text-[#ff682c]' : 'text-[#828282]'
              }`}
            >
              {repsNeedingAttention.length > 0
                ? `${repsNeedingAttention.length} representative(s) have ${OVERDUE_ATTENTION_THRESHOLD}+ due-past follow-ups.`
                : 'No representative is behind on follow-ups.'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {repSummary.map((rep) => {
              const needsAttention = rep.duePast >= OVERDUE_ATTENTION_THRESHOLD;
              return (
                <button
                  key={rep.id}
                  onClick={() => setSelectedRepId(selectedRepId === rep.id ? 'all' : rep.id)}
                  className={`p-2.5 rounded border text-left transition-all ${
                    selectedRepId === rep.id
                      ? 'bg-[#202020] text-white border-[#202020]'
                      : `bg-white text-[#202020] border-[#e8e8e8] hover:border-[#d4d4d4] ${
                          needsAttention ? 'ring-1 ring-[#ff682c]' : ''
                        }`
                  }`}
                >
                  <span className="text-xs font-medium block truncate">
                    {rep.full_name.split(' ')[0]}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 mt-1 text-[10px] font-mono">
                    <span className={selectedRepId === rep.id ? 'text-[#ff682c]' : 'text-amber-600'}>
                      {rep.todayPending} pending
                    </span>
                    <span className={selectedRepId === rep.id ? 'text-[#ffb899]' : 'text-[#ff682c]'}>
                      {rep.duePast} due past
                    </span>
                    <span className={selectedRepId === rep.id ? 'text-emerald-300' : 'text-emerald-700'}>
                      {rep.todayCompleted} done
                    </span>
                  </div>
                  {needsAttention && (
                    <span
                      className={`text-[10px] font-mono mt-0.5 block ${
                        selectedRepId === rep.id ? 'text-[#ffb899]' : 'text-[#ff682c]'
                      }`}
                    >
                      Needs attention
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 pt-4 border-t border-[#e0e0e0] flex flex-wrap items-center gap-3">
          {/* Date Filter */}
          <div className="flex items-center gap-1 bg-white p-1 rounded border border-[#e8e8e8]">
            <button
              onClick={() => setDateRange('today')}
              className={`px-3 py-1 text-xs font-mono rounded ${
                dateRange === 'today' ? 'bg-[#202020] text-white' : 'text-[#4d4d4d]'
              }`}
            >
              Today + Past Due
            </button>
            <button
              onClick={() => setDateRange('week')}
              className={`px-3 py-1 text-xs font-mono rounded ${
                dateRange === 'week' ? 'bg-[#202020] text-white' : 'text-[#4d4d4d]'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDateRange('all')}
              className={`px-3 py-1 text-xs font-mono rounded ${
                dateRange === 'all' ? 'bg-[#202020] text-white' : 'text-[#4d4d4d]'
              }`}
            >
              All Dates
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs p-1.5 bg-white border border-[#e8e8e8] rounded text-[#202020] font-mono"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending Only</option>
            <option value="Completed">Completed Only</option>
            <option value="due_past">Due Past Only</option>
          </select>

          {/* Rep Filter */}
          <select
            value={selectedRepId}
            onChange={(e) => setSelectedRepId(e.target.value)}
            className="text-xs p-1.5 bg-white border border-[#e8e8e8] rounded text-[#202020] font-mono"
          >
            <option value="all">All Sales Representatives</option>
            {reps.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.full_name}
              </option>
            ))}
          </select>

          <span className="text-xs font-mono text-[#828282] ml-auto">
            Showing {filteredFollowups.length} scheduled items
          </span>
        </div>
      </div>

      {/* Followups Table / Cards */}
      <div className="space-y-2.5">
        {filteredFollowups.length === 0 ? (
          <div className="p-12 text-center bg-white border border-[#e8e8e8] rounded-lg">
            <p className="text-sm text-[#202020]">No follow-ups match your selected criteria.</p>
          </div>
        ) : (
          filteredFollowups.map((item) => {
            const lead = leads.find((l) => l.id === item.lead_id);
            const rep = profiles.find((p) => p.id === item.rep_id);

            return (
              <div
                key={item.id}
                className="bg-white border border-[#e8e8e8] hover:border-[#202020] rounded-lg p-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-[#202020] font-semibold">{item.followup_date}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          item.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-[#ff682c]">
                        Rep: {rep?.full_name || 'Unassigned'}
                      </span>
                      {isFollowupDuePast(item, todayStr) && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#ff682c] text-white font-semibold">
                          Due past · {followupDaysPastDue(item.followup_date, todayStr)}d
                        </span>
                      )}
                    </div>

                    {lead && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="text-base font-medium text-[#202020] hover:text-[#ff682c] transition-colors"
                        >
                          {lead.name}
                        </button>
                        <span className="text-xs text-[#828282] font-mono">
                          ({lead.preferred_property})
                        </span>
                      </div>
                    )}

                    {item.notes && (
                      <p className="text-xs text-[#4d4d4d]">{item.notes}</p>
                    )}
                  </div>

                  {lead && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onSelectLead(lead)}
                        className="px-3 py-1.5 bg-[#efefef] hover:bg-[#e4e4e4] text-xs font-mono text-[#202020] rounded transition-colors"
                      >
                        Inspect Lead →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
