'use client';

import React, { useMemo } from 'react';
import { useCRM } from '@/lib/crmContext';
import { Lead } from '@/lib/types';
import { getTodayDateStr } from '@/lib/utils';
import { Activity, Home } from 'lucide-react';

interface MasterControlViewProps {
  onSelectLead: (lead: Lead) => void;
  onNavigateTab: (tab: string) => void;
}

export default function MasterControlView({
  onSelectLead,
  onNavigateTab,
}: MasterControlViewProps) {
  const { leads, interactions, followups, profiles } = useCRM();

  // Pulse Stats across entire real estate sales team
  const totalLeads = leads.length;
  const activeVisits = leads.filter((l) => l.status === 'Site Visit' || l.status === 'Negotiation').length;
  const closedDeals = leads.filter((l) => l.status === 'Closed Won').length;

  // Local calendar day: toISOString() would still report yesterday's date for
  // the first hours of the local day in UTC+ timezones.
  const todayStr = getTodayDateStr();
  const todayFollowups = followups.filter((f) => f.followup_date === todayStr);
  const pendingToday = todayFollowups.filter((f) => f.status === 'Pending').length;

  // Newest first. Sorted once per data change rather than on every render.
  const sortedInteractions = useMemo(
    () =>
      [...interactions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [interactions]
  );

  return (
    <div className="space-y-6">
      {/* Master Header */}
      <div className="bg-[#efefef] p-4 rounded-lg border border-[#e8e8e8] sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-[#ff682c]" />
              <span className="text-xs font-mono text-[#828282] uppercase tracking-wider">
                Executive Overview
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-normal text-[#202020] tracking-tight">
              Sales Activity & Operations
            </h1>
            <p className="text-xs sm:text-sm text-[#4d4d4d] mt-1">
              Real-time monitoring of client interactions, pipeline conversions, and team milestones.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('leads')}
              className="px-3 py-2 bg-white hover:bg-[#f5f5f5] text-xs font-mono text-[#202020] border border-[#e8e8e8] rounded transition-colors"
            >
              Lead Directory →
            </button>
            <button
              onClick={() => onNavigateTab('team-followups')}
              className="px-3 py-2 bg-[#202020] text-white text-xs font-mono hover:bg-black transition-colors"
            >
              Team Follow-ups →
            </button>
          </div>
        </div>

        {/* Executive Pulse Metrics.
            On a phone this is one strip of four counters: the long labels and the
            explanatory captions below each number are what forced a 2x2 grid, so
            they are swapped for a short label and revealed from sm upwards. */}
        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-[#e0e0e0] pt-4 sm:mt-6 sm:gap-3 sm:pt-5">
          <div className="bg-white px-1.5 py-2.5 rounded border border-[#e8e8e8] sm:p-4">
            <span className="block text-[9px] leading-tight font-mono uppercase text-[#828282] sm:text-[10px] sm:leading-normal">
              <span className="sm:hidden">Inquiries</span>
              <span className="hidden sm:inline">Total Inquiries</span>
            </span>
            <span className="block text-lg font-mono font-bold text-[#202020] sm:text-2xl">
              {totalLeads}
            </span>
            <span className="hidden text-[10px] text-[#4d4d4d] sm:mt-0.5 sm:block">
              Across all properties
            </span>
          </div>

          <div className="bg-white px-1.5 py-2.5 rounded border border-[#e8e8e8] sm:p-4">
            <span className="block text-[9px] leading-tight font-mono uppercase text-[#828282] sm:text-[10px] sm:leading-normal">
              <span className="sm:hidden">Visits</span>
              <span className="hidden sm:inline">Site Visits &amp; Neg.</span>
            </span>
            <span className="block text-lg font-mono font-bold text-[#ff682c] sm:text-2xl">
              {activeVisits}
            </span>
            <span className="hidden text-[10px] text-[#4d4d4d] sm:mt-0.5 sm:block">
              High intent pipeline
            </span>
          </div>

          <div className="bg-white px-1.5 py-2.5 rounded border border-[#e8e8e8] sm:p-4">
            <span className="block text-[9px] leading-tight font-mono uppercase text-[#828282] sm:text-[10px] sm:leading-normal">
              <span className="sm:hidden">Due Today</span>
              <span className="hidden sm:inline">Follow-ups Due Today</span>
            </span>
            <span className="block text-lg font-mono font-bold text-[#816729] sm:text-2xl">
              {pendingToday}
            </span>
            <span className="hidden text-[10px] text-[#4d4d4d] sm:mt-0.5 sm:block">
              {todayFollowups.length - pendingToday} completed
            </span>
          </div>

          <div className="bg-white px-1.5 py-2.5 rounded border border-[#e8e8e8] sm:p-4">
            <span className="block text-[9px] leading-tight font-mono uppercase text-[#828282] sm:text-[10px] sm:leading-normal">
              <span className="sm:hidden">Reps</span>
              <span className="hidden sm:inline">Active Representatives</span>
            </span>
            <span className="block text-lg font-mono font-bold text-emerald-600 sm:text-2xl">
              {profiles.filter((p) => p.role === 'Sales_Rep').length}
            </span>
            <span className="hidden text-[10px] text-[#4d4d4d] sm:mt-0.5 sm:block">
              Dedicated sales team
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Interaction Feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#ff682c]" />
            <h2 className="text-sm font-mono uppercase tracking-wider text-[#202020] font-semibold">
              Recent Team Interactions & Logs
            </h2>
          </div>
          <span className="text-xs font-mono text-[#828282]">
            {sortedInteractions.length} recorded entries
          </span>
        </div>

        <div className="space-y-3">
          {sortedInteractions.map((item) => {
            const lead = leads.find((l) => l.id === item.lead_id);
            const rep = profiles.find((p) => p.id === item.rep_id);

            return (
              <div
                key={item.id}
                className="bg-white border border-[#e8e8e8] hover:border-[#d4d4d4] rounded-lg p-4 sm:p-5 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-[#202020] bg-[#efefef] px-2 py-0.5 rounded">
                        {item.interaction_type}
                      </span>
                      <span className="text-xs font-mono text-[#ff682c] font-medium">
                        Rep: {rep?.full_name || 'System / Auto'}
                      </span>
                      <span className="text-[11px] font-mono text-[#828282]">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-[#202020] leading-relaxed whitespace-pre-wrap">
                      {item.notes}
                    </p>

                    {lead && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="text-xs font-medium text-[#202020] hover:text-[#ff682c] transition-colors flex items-center gap-1 font-mono"
                        >
                          <Home className="w-3 h-3 text-[#828282]" />
                          <span>
                            Lead: {lead.name} · {lead.preferred_property}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {lead && (
                    <button
                      onClick={() => onSelectLead(lead)}
                      className="text-xs font-mono text-[#828282] hover:text-[#202020] hover:bg-[#efefef] px-2.5 py-1.5 rounded transition-colors self-start shrink-0 border border-[#e8e8e8]"
                    >
                      View Lead Details →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
