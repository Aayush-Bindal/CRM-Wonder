'use client';

import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCRM } from '@/lib/crmContext';
import { getTodayDateStr, isFollowupDuePast, OVERDUE_ATTENTION_THRESHOLD } from '@/lib/utils';
import type { ChartConfig } from '@/components/ui/chart';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const chartConfig = {
  active: { label: 'Active leads', color: '#202020' },
  won: { label: 'Closed won', color: '#816729' },
  lost: { label: 'Closed lost', color: '#c4c4c4' },
  duePast: { label: 'Due past', color: '#ff682c' },
} satisfies ChartConfig;

// The four series are counts of the same unit (leads / follow-ups per rep), so
// one grouped bar row per rep is the comparison the Admin actually needs.
// Collapsed until asked for: the dashboard's job is the pulse numbers, and the
// chart is a drill-down, so its body (and Recharts) stays unmounted until then.
export default function TeamPerformanceChart({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const { profiles, leads, followups } = useCRM();

  const todayStr = getTodayDateStr();

  const data = React.useMemo(() => {
    const reps = profiles.filter((p) => p.role === 'Sales_Rep' && p.is_active);

    return reps
      .map((rep) => {
        const repLeads = leads.filter((l) => l.assigned_rep_id === rep.id);
        const repFollowups = followups.filter((f) => f.rep_id === rep.id);
        const won = repLeads.filter((l) => l.status === 'Closed Won').length;
        const lost = repLeads.filter((l) => l.status === 'Closed Lost').length;

        return {
          repId: rep.id,
          fullName: rep.full_name,
          active: repLeads.filter(
            (l) =>
              l.status === 'New' ||
              l.status === 'Contacted' ||
              l.status === 'Site Visit' ||
              l.status === 'Negotiation'
          ).length,
          won,
          lost,
          duePast: repFollowups.filter((f) => isFollowupDuePast(f, todayStr)).length,
          pendingToday: repFollowups.filter(
            (f) => f.status === 'Pending' && f.followup_date === todayStr
          ).length,
          completedToday: repFollowups.filter(
            (f) => f.status === 'Completed' && f.followup_date === todayStr
          ).length,
          winRate: won + lost === 0 ? null : Math.round((won / (won + lost)) * 100),
        };
      })
      .sort(
        (a, b) =>
          b.active + b.won + b.lost - (a.active + a.won + a.lost) ||
          a.fullName.localeCompare(b.fullName)
      );
  }, [profiles, leads, followups, todayStr]);

  const needsAttention = data.filter((rep) => rep.duePast >= OVERDUE_ATTENTION_THRESHOLD);
  const chartHeight = Math.max(220, data.length * 56 + 40);

  return (
    <div className="rounded-lg border border-[#e8e8e8] bg-white p-4 sm:p-6">
      <div className={`flex items-start justify-between gap-3 ${expanded ? 'mb-3' : ''}`}>
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#828282]">
            Team Performance
          </span>
          <h2 className="text-lg font-normal text-[#202020] tracking-tight">
            Representative Comparison
          </h2>
          <p
            className={`text-[11px] font-mono mt-1 ${
              needsAttention.length > 0 ? 'text-[#ff682c]' : 'text-[#828282]'
            }`}
          >
            {needsAttention.length > 0
              ? `${needsAttention.length} representative(s) have ${OVERDUE_ATTENTION_THRESHOLD}+ due-past follow-ups.`
              : 'No representative is behind on follow-ups.'}
          </p>
        </div>
        <button
          id="toggle-team-performance-btn"
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls="team-performance-body"
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 border border-[#e8e8e8] rounded text-[11px] font-mono text-[#4d4d4d] hover:text-[#202020] hover:bg-[#f5f5f5] transition-colors"
        >
          <span>{expanded ? 'Hide chart' : 'Show chart'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div id="team-performance-body">
          {data.length === 0 ? (
            <p className="text-xs text-[#828282] py-8 text-center">
              No active Sales Representatives yet.
            </p>
          ) : (
            <>
              <ChartContainer
                config={chartConfig}
                style={{ height: chartHeight }}
                className="aspect-auto w-full [&_.recharts-cartesian-axis-tick_text]:fill-[#828282] [&_.recharts-cartesian-axis-tick_text]:font-mono"
              >
                <BarChart
                  data={data}
                  layout="vertical"
                  barGap={2}
                  margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
                >
                  <CartesianGrid horizontal={false} stroke="#e8e8e8" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickCount={4}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="fullName"
                    width={96}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value: string) => {
                      const [first, ...rest] = value.trim().split(/\s+/);
                      const last = rest[rest.length - 1];
                      return last ? `${first} ${last[0]}.` : first;
                    }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: '#f5f5f5' }} />
                  <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-3 gap-y-1" />} />
                  <Bar dataKey="active" fill="var(--color-active)" radius={[0, 3, 3, 0]} barSize={10} />
                  <Bar dataKey="won" fill="var(--color-won)" radius={[0, 3, 3, 0]} barSize={10} />
                  <Bar dataKey="lost" fill="var(--color-lost)" radius={[0, 3, 3, 0]} barSize={10} />
                  <Bar dataKey="duePast" fill="var(--color-duePast)" radius={[0, 3, 3, 0]} barSize={10} />
                </BarChart>
              </ChartContainer>

              <div className="mt-3">
                {data.map((rep) => (
                  <div
                    key={rep.repId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#f0f0f0] py-1.5 text-[11px] font-mono"
                  >
                    <span className="text-[#202020] font-medium">{rep.fullName}</span>
                    <span className="text-[#4d4d4d]">
                      Win rate {rep.winRate === null ? '—' : `${rep.winRate}%`}
                    </span>
                    <span className="text-[#828282]">{rep.pendingToday} pending today</span>
                    <span className="text-[#828282]">{rep.duePast} due past</span>
                    {rep.duePast >= OVERDUE_ATTENTION_THRESHOLD && (
                      <span className="text-[#ff682c] uppercase tracking-wider">Needs attention</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
