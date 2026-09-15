'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crmContext';
import { UserRole } from '@/lib/types';
import {
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  Mail,
  Phone,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export default function UserManagementView() {
  const { profiles, leads, createRepAccount } = useCRM();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('Sales_Rep');
  const [showAddForm, setShowAddForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    await createRepAccount({
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
    });

    setFeedback(`Account created for ${fullName}! The representative can now log in.`);
    setFullName('');
    setEmail('');
    setPhone('');
    setShowAddForm(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const reps = profiles.filter((p) => p.role === 'Sales_Rep');
  const admins = profiles.filter((p) => p.role === 'Admin');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#efefef] p-6 rounded-lg border border-[#e8e8e8]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-[#ff682c]" />
              <span className="text-xs font-mono text-[#828282] uppercase tracking-wider">
                Team Administration
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-normal text-[#202020] tracking-tight">
              User Management ({profiles.length} Members)
            </h1>
            <p className="text-xs sm:text-sm text-[#4d4d4d] mt-1">
              Manage sales representatives, view assigned workloads, and add new members to your team.
            </p>
          </div>

          <button
            id="open-create-user-modal-btn"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-[#202020] hover:bg-black text-white text-xs font-medium transition-colors flex items-center justify-center gap-2 shrink-0"
          >
            <UserPlus className="w-4 h-4 text-[#ff682c]" />
            <span>+ Add Team Member</span>
          </button>
        </div>

        {feedback && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Inline Create Form */}
        {showAddForm && (
          <div className="mt-6 pt-5 border-t border-[#e0e0e0] bg-white p-5 rounded-lg border border-[#e8e8e8] animate-in fade-in">
            <h3 className="text-sm font-semibold text-[#202020] mb-3 font-mono uppercase">
              Add New Team Member
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Rachel Adams"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs p-2 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                  Corporate Email
                </label>
                <input
                  required
                  type="email"
                  placeholder="rachel.a@luxuryliving.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs p-2 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                  Phone (WhatsApp / SMS)
                </label>
                <input
                  required
                  type="tel"
                  placeholder="+1 (555) 000-1122"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs p-2 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                  System Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full text-xs p-2 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] font-mono"
                >
                  <option value="Sales_Rep">Sales Representative</option>
                  <option value="Admin">Administrator</option>
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs font-mono text-[#4d4d4d] hover:bg-[#efefef] rounded"
                >
                  Cancel
                </button>
                <button
                  id="confirm-create-account-btn"
                  type="submit"
                  className="px-4 py-1.5 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((profile) => {
          const repLeadCount = leads.filter((l) => l.assigned_rep_id === profile.id).length;

          return (
            <div
              key={profile.id}
              className="bg-white border border-[#e8e8e8] hover:border-[#d4d4d4] rounded-lg p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-full bg-[#efefef] flex items-center justify-center font-mono text-xs font-semibold text-[#202020]">
                    {profile.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                      profile.role === 'Admin'
                        ? 'bg-[#202020] text-white'
                        : 'bg-[#efefef] text-[#202020]'
                    }`}
                  >
                    {profile.role === 'Admin' ? 'Administrator' : 'Sales Representative'}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-[#202020]">
                  {profile.full_name}
                </h3>

                <div className="space-y-1 mt-2 text-xs font-mono text-[#4d4d4d]">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#828282]" />
                    <span className="truncate">{profile.email}</span>
                  </div>
                  {profile.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#828282]" />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#e8e8e8] flex items-center justify-between">
                <span className="text-xs font-mono text-[#816729]">
                  {profile.role === 'Sales_Rep'
                    ? `${repLeadCount} assigned leads`
                    : 'All leads access'}
                </span>

                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
