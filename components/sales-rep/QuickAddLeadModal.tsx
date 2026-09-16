'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/crmContext';
import { getRelativeDateStr } from '@/lib/utils';
import { X, Calendar, Gift, Heart } from 'lucide-react';

interface QuickAddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickAddLeadModal({ isOpen, onClose }: QuickAddLeadModalProps) {
  const { addLead, currentUser, profiles } = useCRM();

  const [name, setName] = useState('');
  const [phone1, setPhone1] = useState('');
  const [mobile2, setMobile2] = useState('');
  const [address, setAddress] = useState('');
  const [preferredProperty, setPreferredProperty] = useState('');
  const [budget, setBudget] = useState('');
  const [dob, setDob] = useState('');
  const [anniversary, setAnniversary] = useState('');
  const [initialNotes, setInitialNotes] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState(getRelativeDateStr(1)); // tomorrow by default
  // An Admin must choose a rep: defaulting to currentUser.id would put the lead
  // on an Administrator, which no rep dashboard ever shows and no rep follow-up
  // query ever returns.
  const [assignedRepId, setAssignedRepId] = useState(
    currentUser?.role === 'Admin' ? '' : currentUser?.id || ''
  );
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'Admin';
  const reps = profiles.filter((p) => p.role === 'Sales_Rep');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone1.trim() || !preferredProperty.trim()) {
      return;
    }

    if (isAdmin && !reps.some((rep) => rep.id === assignedRepId)) {
      setFormError('Select the sales representative this lead belongs to.');
      return;
    }

    setFormError(null);
    setLoading(true);

    const result = await addLead({
      name: name.trim(),
      phone_1: phone1.trim(),
      mobile_2: mobile2.trim() || undefined,
      address: address.trim() || undefined,
      preferred_property: preferredProperty.trim(),
      budget: budget.trim() || undefined,
      dob: dob || undefined,
      marriage_anniversary: anniversary || undefined,
      assigned_rep_id: assignedRepId || currentUser?.id,
      initialNotes: initialNotes.trim() || undefined,
      nextFollowupDate: nextFollowupDate || undefined,
    });

    setLoading(false);

    // Keep the form open on failure so nothing the rep typed is lost.
    if (!result.success) {
      setFormError(result.error || 'The lead could not be saved.');
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl border border-[#e8e8e8] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-[#efefef] border-b border-[#e8e8e8] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#828282] uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-[#ff682c]" />
              <span>Lead Capture</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-normal text-[#202020] tracking-tight">
              Add Lead &amp; Follow-Up
            </h2>
          </div>

          <button
            id="close-quick-add-btn"
            onClick={onClose}
            className="p-1.5 text-[#828282] hover:text-[#202020] hover:bg-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded">
              {formError}
            </div>
          )}
          {/* Section 1: Lead Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-[#4d4d4d] mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="quick-add-name"
                required
                type="text"
                placeholder="e.g. Jonathan Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#4d4d4d] mb-1">
                Primary Phone 1 <span className="text-red-500">*</span>
              </label>
              <input
                id="quick-add-phone-1"
                required
                type="tel"
                placeholder="+91 98765 43210"
                value={phone1}
                onChange={(e) => setPhone1(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#4d4d4d] mb-1">
                Secondary Mobile 2 (Optional)
              </label>
              <input
                id="quick-add-phone-2"
                type="tel"
                placeholder="Spouse / Assistant phone"
                value={mobile2}
                onChange={(e) => setMobile2(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#4d4d4d] mb-1">
                Preferred Property / Flat Unit <span className="text-red-500">*</span>
              </label>
              <input
                id="quick-add-property"
                required
                type="text"
                placeholder="e.g. 3BHK Flat 1204, Marina Residences"
                value={preferredProperty}
                onChange={(e) => setPreferredProperty(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#4d4d4d] mb-1">
                Budget / Range
              </label>
              <input
                id="quick-add-budget"
                type="text"
                placeholder="e.g. ₹85 L - ₹1.2 Cr"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
              />
            </div>

            {isAdmin && (
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#4d4d4d] mb-1">
                  Assign To Sales Rep
                </label>
                <select
                  id="quick-add-assign-rep"
                  value={assignedRepId}
                  onChange={(e) => setAssignedRepId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                >
                  <option value="">Select a representative…</option>
                  {reps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-[#4d4d4d] mb-1">
              Residential Address
            </label>
            <input
              id="quick-add-address"
              type="text"
              placeholder="e.g. 42 Park Avenue, Penthouse B"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-xs p-2.5 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
            />
          </div>

          {/* Section 2: Important Personal Dates for Automated Greetings */}
          <div className="bg-[#f5f5f5] p-3.5 rounded border border-[#e8e8e8]">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#828282] mb-2 flex items-center gap-1.5">
              <span>Personal Dates (Edge Function Daily Greetings Engine)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-[#4d4d4d] mb-1 flex items-center gap-1">
                  <Gift className="w-3 h-3 text-[#ff682c]" /> Date of Birth (DOB)
                </label>
                <input
                  id="quick-add-dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-[#4d4d4d] mb-1 flex items-center gap-1">
                  <Heart className="w-3 h-3 text-[#ff682c]" /> Marriage Anniversary
                </label>
                <input
                  id="quick-add-anniversary"
                  type="date"
                  value={anniversary}
                  onChange={(e) => setAnniversary(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Notes & Follow-up in one flow */}
          <div className="border-t border-[#e8e8e8] pt-4 space-y-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-[#4d4d4d] mb-1">
                First Interaction Notes / Inquiry Context
              </label>
              <textarea
                id="quick-add-notes"
                rows={2}
                placeholder="e.g. Walked into marketing suite with spouse. Looking for east-facing balcony."
                value={initialNotes}
                onChange={(e) => setInitialNotes(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#4d4d4d] mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#ff682c]" /> Schedule Next Follow-up Date
              </label>
              <input
                id="quick-add-followup-date"
                type="date"
                value={nextFollowupDate}
                onChange={(e) => setNextFollowupDate(e.target.value)}
                className="w-full sm:w-1/2 text-xs p-2 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#e8e8e8] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-[#4d4d4d] hover:bg-[#efefef] rounded transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-quick-add-btn"
              type="submit"
              disabled={loading || !name.trim() || !phone1.trim() || !preferredProperty.trim()}
              className="px-5 py-2.5 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding Lead...' : 'Add Lead & Schedule Follow-Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
