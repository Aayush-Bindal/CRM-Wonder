'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCRM } from '@/lib/crmContext';
import { PREFERRED_PROPERTY_TYPES } from '@/lib/types';
import { getRelativeDateStr, normalizePhoneInput } from '@/lib/utils';
import { X, Calendar, Gift, Heart, Check, ChevronDown } from 'lucide-react';

interface QuickAddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickAddLeadModal({ isOpen, onClose }: QuickAddLeadModalProps) {
  const { addLead, currentUser, profiles } = useCRM();

  const [name, setName] = useState('');
  const [phone1, setPhone1] = useState('');
  const [address, setAddress] = useState('');
  const [preferredProperty, setPreferredProperty] = useState<string[]>([]);
  const [isPropertyMenuOpen, setIsPropertyMenuOpen] = useState(false);
  const propertyFieldRef = useRef<HTMLDivElement>(null);
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

  // A click anywhere outside the field closes the option list, the way any
  // dropdown behaves; an inline expanded list would push the rest of the form
  // around instead.
  useEffect(() => {
    if (!isPropertyMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (propertyFieldRef.current && !propertyFieldRef.current.contains(event.target as Node)) {
        setIsPropertyMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isPropertyMenuOpen]);

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'Admin';
  const reps = profiles.filter((p) => p.role === 'Sales_Rep');
  // followups.rep_id is NOT NULL, so an unassigned capture cannot carry one yet.
  const scheduleFollowup = !isAdmin || Boolean(assignedRepId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone1.trim()) {
      return;
    }
    // Nothing native enforces a button-based multi-select, so say why the form
    // did not submit.
    if (preferredProperty.length === 0) {
      setFormError('Select at least one preferred property type.');
      return;
    }

    setFormError(null);
    setLoading(true);

    const result = await addLead({
      name: name.trim(),
      phone_1: normalizePhoneInput(phone1),
      address: address.trim() || undefined,
      preferred_property: preferredProperty.join(', '),
      budget: budget.trim() || undefined,
      dob: dob || undefined,
      marriage_anniversary: anniversary || undefined,
      // An Admin may leave the rep empty: the lead is captured unassigned and
      // assigned later from the Lead Database. undefined keeps the rep's own
      // profile as the owner, which addLead applies as the fallback.
      assigned_rep_id: assignedRepId ? assignedRepId : isAdmin ? null : undefined,
      initialNotes: initialNotes.trim() || undefined,
      nextFollowupDate: scheduleFollowup ? nextFollowupDate || undefined : undefined,
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
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
                value={phone1}
                onChange={(e) => setPhone1(normalizePhoneInput(e.target.value))}
                className="w-full text-xs p-2.5 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
              />
            </div>

            <div ref={propertyFieldRef} className="relative">
              <label className="block text-[11px] font-mono uppercase text-[#4d4d4d] mb-1">
                Preferred Property <span className="text-red-500">*</span>
              </label>
              <button
                id="quick-add-property"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isPropertyMenuOpen}
                onClick={() => setIsPropertyMenuOpen((open) => !open)}
                className="w-full min-h-[38px] flex items-center justify-between gap-2 text-xs p-2 bg-[#ffffff] border border-[#e8e8e8] rounded text-[#202020] text-left focus:outline-none focus:border-[#202020]"
              >
                <span className="flex flex-wrap items-center gap-1">
                  {preferredProperty.length === 0 ? (
                    <span className="text-[#828282]">Select property type(s)</span>
                  ) : (
                    preferredProperty.map((option) => (
                      <span
                        key={option}
                        className="px-1.5 py-0.5 rounded bg-[#efefef] text-[#202020] font-mono text-[11px]"
                      >
                        {option}
                      </span>
                    ))
                  )}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 text-[#828282] transition-transform ${
                    isPropertyMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isPropertyMenuOpen && (
                <div
                  role="listbox"
                  aria-multiselectable="true"
                  aria-label="Preferred property types"
                  className="absolute z-20 mt-1 w-full bg-white border border-[#e8e8e8] rounded shadow-lg p-1"
                >
                  {PREFERRED_PROPERTY_TYPES.map((option) => {
                    const selected = preferredProperty.includes(option);
                    return (
                      <button
                        key={option}
                        id={`quick-add-property-option-${option.toLowerCase()}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() =>
                          setPreferredProperty((prev) =>
                            prev.includes(option)
                              ? prev.filter((value) => value !== option)
                              : PREFERRED_PROPERTY_TYPES.filter(
                                  (candidate) => candidate === option || prev.includes(candidate)
                                )
                          )
                        }
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#202020] text-left hover:bg-[#f5f5f5] transition-colors"
                      >
                        <span
                          className={`w-3.5 h-3.5 flex items-center justify-center border rounded-sm ${
                            selected
                              ? 'bg-[#202020] border-[#202020] text-white'
                              : 'border-[#d8d8d8] bg-white'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3" />}
                        </span>
                        <span className="font-mono">{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}
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
                  <option value="">Unassigned (assign later)</option>
                  {reps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.full_name}
                    </option>
                  ))}
                </select>
                {!assignedRepId && (
                  <p className="text-[10px] font-mono text-[#828282] mt-1">
                    No owner: the lead stays unassigned and no follow-up is scheduled.
                  </p>
                )}
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

            {scheduleFollowup ? (
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
            ) : (
              <p className="text-[11px] text-[#828282] bg-[#f5f5f5] border border-[#e8e8e8] rounded p-2.5">
                No follow-up will be scheduled. Assign this lead to a representative from the Lead
                Database, then schedule one.
              </p>
            )}
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
              disabled={loading || !name.trim() || !phone1.trim() || preferredProperty.length === 0}
              className="px-5 py-2.5 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors disabled:opacity-50"
            >
              {loading
                ? 'Adding Lead...'
                : scheduleFollowup
                  ? 'Add Lead & Schedule Follow-Up'
                  : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
