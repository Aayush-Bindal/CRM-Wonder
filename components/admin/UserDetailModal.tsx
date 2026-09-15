'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crmContext';
import { Profile } from '@/lib/types';
import {
  X,
  Mail,
  Phone,
  Lock,
  Eye,
  ShieldCheck,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

interface UserDetailModalProps {
  profile: Profile;
  onClose: () => void;
}

const STATUS_COLORS = {
  success: '#10b981',
  failed: '#ef4444',
  working: '#ff682c',
};

function LeadStatusDonutChart({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let cumulative = 0;
  const gradient =
    total === 0
      ? '#e8e8e8 0deg 360deg'
      : segments
          .map((seg) => {
            const start = (cumulative / total) * 360;
            cumulative += seg.value;
            const end = (cumulative / total) * 360;
            return `${seg.color} ${start}deg ${end}deg`;
          })
          .join(', ');

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative w-28 h-28 rounded-full shrink-0"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="absolute inset-[12px] bg-white rounded-full flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-[#202020]">{total}</span>
          <span className="text-[8px] font-mono uppercase text-[#828282] tracking-wider">
            Total Leads
          </span>
        </div>
      </div>
      <div className="space-y-1.5 flex-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-[#4d4d4d] font-mono truncate">{seg.label}</span>
            </div>
            <span className="font-semibold text-[#202020] shrink-0">
              {seg.value}
              {total > 0 && (
                <span className="text-[#828282] font-normal ml-1">
                  ({Math.round((seg.value / total) * 100)}%)
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UserDetailModal({ profile, onClose }: UserDetailModalProps) {
  const { leads, currentUser } = useCRM();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const isRep = profile.role === 'Sales_Rep';

  const repLeads = leads.filter((l) => l.assigned_rep_id === profile.id);
  const now = new Date();
  const monthLeads = repLeads.filter((l) => {
    const d = new Date(l.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const chartLeads = monthLeads.length > 0 ? monthLeads : repLeads;

  const successCount = chartLeads.filter((l) => l.status === 'Closed Won').length;
  const failedCount = chartLeads.filter((l) => l.status === 'Closed Lost').length;
  const workingCount = chartLeads.length - successCount - failedCount;

  const resetPasswordFlow = () => {
    setShowPasswordForm(false);
    setAdminPassword('');
    setRevealedPassword(null);
    setPasswordError(null);
  };

  const handleRevealPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentUser?.password || adminPassword !== currentUser.password) {
      setPasswordError('Incorrect admin password. Please try again.');
      return;
    }
    setRevealedPassword(profile.password || 'No password set for this account.');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-lg shadow-2xl border border-[#e8e8e8] overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 bg-[#efefef] border-b border-[#e8e8e8] flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {profile.role === 'Admin' ? (
                <ShieldCheck className="w-4 h-4 text-[#202020]" />
              ) : (
                <UserCheck className="w-4 h-4 text-[#ff682c]" />
              )}
              <span className="text-xs font-mono text-[#828282] uppercase tracking-wider">
                {profile.role === 'Admin' ? 'Administrator' : 'Sales Representative'}
              </span>
            </div>
            <h2 className="text-xl font-normal text-[#202020] tracking-tight">
              {profile.full_name}
            </h2>
          </div>

          <button
            id="close-user-detail-modal-btn"
            onClick={onClose}
            className="p-1.5 text-[#828282] hover:text-[#202020] hover:bg-white rounded transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Contact Info */}
          <div className="space-y-1.5 text-xs font-mono text-[#4d4d4d]">
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#828282]" />
              <span>{profile.email}</span>
            </div>
            {profile.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#828282]" />
                <span>{profile.phone}</span>
              </div>
            )}
          </div>

          {/* Password Reveal */}
          <div className="border border-[#e8e8e8] rounded-lg p-4 bg-[#f5f5f5]">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#828282] mb-2.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Account Password
            </h3>

            {revealedPassword ? (
              <div className="p-2.5 bg-white border border-[#d8d8d8] rounded font-mono text-sm text-[#202020] flex items-center justify-between gap-2">
                <span className="truncate">{revealedPassword}</span>
                <button
                  id="hide-password-btn"
                  onClick={resetPasswordFlow}
                  className="text-[10px] text-[#828282] hover:text-[#202020] shrink-0"
                >
                  Hide
                </button>
              </div>
            ) : showPasswordForm ? (
              <form onSubmit={handleRevealPassword} className="space-y-2">
                {passwordError && (
                  <div className="p-2 bg-red-50 border border-red-200 text-[11px] text-red-700 rounded flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}
                <label className="block text-[10px] font-mono uppercase text-[#828282]">
                  Confirm your admin password
                </label>
                <input
                  id="admin-password-confirm-input"
                  type="password"
                  autoFocus
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs p-2 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                />
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={resetPasswordFlow}
                    className="px-3 py-1.5 text-xs font-mono text-[#4d4d4d] hover:bg-white rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-reveal-password-btn"
                    type="submit"
                    className="px-3 py-1.5 bg-[#202020] text-white text-xs font-medium hover:bg-black rounded transition-colors"
                  >
                    Confirm &amp; Reveal
                  </button>
                </div>
              </form>
            ) : (
              <button
                id="view-password-btn"
                onClick={() => setShowPasswordForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#d8d8d8] text-xs font-mono text-[#202020] hover:bg-[#efefef] rounded transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-[#ff682c]" />
                View Password
              </button>
            )}
          </div>

          {/* Lead Performance Pie Chart (Sales Reps only) */}
          {isRep && (
            <div className="border border-[#e8e8e8] rounded-lg p-4">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#828282] mb-3">
                Lead Performance {monthLeads.length > 0 ? '(This Month)' : '(All Time)'}
              </h3>
              <LeadStatusDonutChart
                segments={[
                  { label: 'Success (Closed Won)', value: successCount, color: STATUS_COLORS.success },
                  { label: 'Rejected / Failed', value: failedCount, color: STATUS_COLORS.failed },
                  { label: 'Working / Remaining', value: workingCount, color: STATUS_COLORS.working },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
