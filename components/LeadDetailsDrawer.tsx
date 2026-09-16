'use client';

import React, { useState } from 'react';
import { Lead, LeadStatus, InteractionType, LeadEditableFields } from '@/lib/types';
import { useCRM } from '@/lib/crmContext';
import {
  X,
  Phone,
  MessageSquare,
  Calendar,
  Home,
  MapPin,
  Gift,
  Heart,
  Send,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  AlertCircle,
} from 'lucide-react';

interface LeadDetailsDrawerProps {
  lead: Lead | null;
  onClose: () => void;
}

// New and Closed Won/Lost are set implicitly (on creation) or via the direct
// Mark Success / Mark Failed actions below, so the pipeline dropdown only
// needs the in-progress working stages.
const PIPELINE_STAGES: LeadStatus[] = ['Contacted', 'Site Visit', 'Negotiation'];

export default function LeadDetailsDrawer({ lead, onClose }: LeadDetailsDrawerProps) {
  const {
    leads,
    interactions,
    followups,
    logInteraction,
    updateLeadStatus,
    updateLead,
    deleteLead,
    profiles,
    currentUser,
  } = useCRM();

  const [noteText, setNoteText] = useState('');
  const [interactionType, setInteractionType] = useState<InteractionType>('Phone Call');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackIsError, setFeedbackIsError] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [details, setDetails] = useState<LeadEditableFields>({
    name: '',
    phone_1: '',
    mobile_2: '',
    address: '',
    dob: '',
    marriage_anniversary: '',
    preferred_property: '',
    budget: '',
  });

  if (!lead) return null;

  // Always read the live lead from context so status changes reflect immediately
  const activeLead = leads.find((l) => l.id === lead.id) || lead;

  // Filter interactions and followups specifically for this lead
  const leadInteractions = interactions.filter((i) => i.lead_id === activeLead.id);
  const leadFollowups = followups.filter((f) => f.lead_id === activeLead.id);
  const assignedRep = profiles.find((p) => p.id === activeLead.assigned_rep_id);

  // The UI mirrors the rule the database enforces: the lead's owner may correct
  // or remove it, and an Admin may do so for any lead.
  const canManage =
    currentUser?.role === 'Admin' || currentUser?.id === activeLead.assigned_rep_id;

  const showFeedback = (message: string, isError = false) => {
    setFeedback(message);
    setFeedbackIsError(isError);
    setTimeout(() => setFeedback(null), 4000);
  };

  const startEditing = () => {
    setDetails({
      name: activeLead.name,
      phone_1: activeLead.phone_1,
      mobile_2: activeLead.mobile_2 ?? '',
      address: activeLead.address ?? '',
      dob: activeLead.dob ?? '',
      marriage_anniversary: activeLead.marriage_anniversary ?? '',
      preferred_property: activeLead.preferred_property,
      budget: activeLead.budget ?? '',
    });
    setShowDeleteConfirm(false);
    setIsEditing(true);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDetails(true);
    const result = await updateLead(activeLead.id, details);
    setIsSavingDetails(false);

    if (!result.success) {
      showFeedback(result.error || 'Could not save the lead details.', true);
      return;
    }

    setIsEditing(false);
    showFeedback('Lead details updated.');
  };

  const handleDeleteLead = async () => {
    setIsDeleting(true);
    const result = await deleteLead(activeLead.id);
    setIsDeleting(false);

    if (!result.success) {
      showFeedback(result.error || 'Could not delete this lead.', true);
      return;
    }

    // The record is gone, so the drawer's lead reference is dangling.
    onClose();
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    const ok = await updateLeadStatus(activeLead.id, newStatus);
    if (!ok) showFeedback('Could not update the pipeline stage. Please retry.', true);
  };

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setIsSubmitting(true);
    const ok = await logInteraction({
      lead_id: activeLead.id,
      notes: noteText.trim(),
      interaction_type: interactionType,
      nextFollowupDate: nextFollowupDate || undefined,
      nextFollowupNotes: `Follow-up after ${interactionType}`,
    });
    setIsSubmitting(false);

    // Only clear the form once the note is actually stored — a rejected write
    // (the lead may have been reassigned meanwhile) must not look like success
    // and must not discard what was typed.
    if (!ok) {
      showFeedback(
        'Could not save this note — the lead may no longer be assigned to you. Your text is preserved.',
        true
      );
      return;
    }

    setNoteText('');
    setNextFollowupDate('');
    showFeedback('Interaction logged and follow-up updated!');
  };

  const cleanPhone1 = activeLead.phone_1.replace(/[^0-9+]/g, '');

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-[1px] flex justify-end animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-[#e8e8e8] animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#e8e8e8] bg-[#efefef] flex items-start justify-between">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-white text-[#202020] border border-[#d8d8d8]">
                {activeLead.status}
              </span>
              <span className="text-xs font-mono text-[#828282]">
                ID: {activeLead.id.slice(-6)}
              </span>
            </div>
            <h2 className="text-xl font-normal text-[#202020] tracking-tight truncate">
              {activeLead.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[#4d4d4d] mt-1 font-mono truncate">
              <Home className="w-3.5 h-3.5 text-[#ff682c] shrink-0" />
              <span className="font-semibold text-[#202020] truncate">{activeLead.preferred_property}</span>
            </div>
          </div>

          <button
            id="close-lead-drawer-btn"
            onClick={onClose}
            className="p-2 text-[#828282] hover:text-[#202020] hover:bg-white rounded transition-colors shrink-0"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Contact Bar for Mobile Sales Rep */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-[#f5f5f5] border-b border-[#e8e8e8]">
          <a
            id="lead-call-btn"
            href={`tel:${cleanPhone1}`}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors rounded"
          >
            <Phone className="w-3.5 h-3.5 text-[#ff682c]" />
            <span className="truncate">Call Lead</span>
          </a>

          <a
            id="lead-whatsapp-btn"
            href={`https://wa.me/${cleanPhone1.replace('+', '')}?text=Hello%20${encodeURIComponent(
              activeLead.name
            )},%20following%20up%20from%20Wonder%20regarding%20${encodeURIComponent(activeLead.preferred_property)}.`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white text-[#202020] border border-[#d8d8d8] text-xs font-medium hover:bg-[#efefef] transition-colors rounded"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
            <span className="truncate">WhatsApp</span>
          </a>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Lead Details: read-only grid, or the correction form once editing */}
          {isEditing ? (
            <form
              onSubmit={handleSaveDetails}
              className="border border-[#e8e8e8] p-4 bg-white rounded space-y-3"
            >
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#202020] font-semibold">
                Correct Lead Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-lead-name"
                    required
                    type="text"
                    value={details.name}
                    onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))}
                    className="w-full text-xs p-2.5 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                    Preferred Property <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-lead-property"
                    required
                    type="text"
                    value={details.preferred_property}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, preferred_property: e.target.value }))
                    }
                    className="w-full text-xs p-2.5 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                    Primary Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-lead-phone-1"
                    required
                    type="tel"
                    value={details.phone_1}
                    onChange={(e) => setDetails((d) => ({ ...d, phone_1: e.target.value }))}
                    className="w-full text-xs p-2.5 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                    Secondary Mobile
                  </label>
                  <input
                    id="edit-lead-phone-2"
                    type="tel"
                    value={details.mobile_2}
                    onChange={(e) => setDetails((d) => ({ ...d, mobile_2: e.target.value }))}
                    className="w-full text-xs p-2.5 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                    Budget
                  </label>
                  <input
                    id="edit-lead-budget"
                    type="text"
                    value={details.budget}
                    onChange={(e) => setDetails((d) => ({ ...d, budget: e.target.value }))}
                    className="w-full text-xs p-2.5 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                    Residential Address
                  </label>
                  <input
                    id="edit-lead-address"
                    type="text"
                    value={details.address}
                    onChange={(e) => setDetails((d) => ({ ...d, address: e.target.value }))}
                    className="w-full text-xs p-2.5 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1 flex items-center gap-1">
                    <Gift className="w-3 h-3 text-[#ff682c]" /> Date of Birth (DOB)
                  </label>
                  <input
                    id="edit-lead-dob"
                    type="date"
                    value={details.dob}
                    onChange={(e) => setDetails((d) => ({ ...d, dob: e.target.value }))}
                    className="w-full text-xs p-2 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1 flex items-center gap-1">
                    <Heart className="w-3 h-3 text-[#ff682c]" /> Marriage Anniversary
                  </label>
                  <input
                    id="edit-lead-anniversary"
                    type="date"
                    value={details.marriage_anniversary}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, marriage_anniversary: e.target.value }))
                    }
                    className="w-full text-xs p-2 bg-white border border-[#e8e8e8] rounded text-[#202020] focus:outline-none focus:border-[#202020]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-2 bg-white text-[#4d4d4d] border border-[#e8e8e8] text-xs hover:bg-[#efefef] rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="save-lead-details-btn"
                  type="submit"
                  disabled={isSavingDetails}
                  className="px-4 py-2 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors rounded disabled:opacity-50"
                >
                  {isSavingDetails ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-[#f5f5f5] p-4 rounded border border-[#e8e8e8]">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-mono uppercase text-[#828282] tracking-wider">
                  Lead Details
                </span>
                {canManage && (
                  <button
                    id="edit-lead-btn"
                    type="button"
                    onClick={startEditing}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#d8d8d8] text-[10px] font-mono text-[#202020] hover:bg-[#efefef] rounded transition-colors"
                  >
                    <Pencil className="w-3 h-3 text-[#ff682c]" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#828282] block">
                    Primary Phone
                  </span>
                  <span className="font-mono text-sm text-[#202020]">{activeLead.phone_1}</span>
                </div>

                {activeLead.mobile_2 && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#828282] block">
                      Secondary Mobile
                    </span>
                    <span className="font-mono text-sm text-[#202020]">{activeLead.mobile_2}</span>
                  </div>
                )}

                {activeLead.budget && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#828282] block">
                      Budget
                    </span>
                    <span className="font-medium text-[#202020]">{activeLead.budget}</span>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-mono uppercase text-[#828282] block">
                    Assigned Advisor
                  </span>
                  <span className="font-medium text-[#202020]">
                    {assignedRep?.full_name || 'Unassigned'}
                  </span>
                </div>

                {activeLead.dob && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#828282] flex items-center gap-1">
                      <Gift className="w-3 h-3 text-[#ff682c]" /> Date of Birth (DOB)
                    </span>
                    <span className="font-mono text-[#202020]">{activeLead.dob}</span>
                  </div>
                )}

                {activeLead.marriage_anniversary && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#828282] flex items-center gap-1">
                      <Heart className="w-3 h-3 text-[#ff682c]" /> Marriage Anniversary
                    </span>
                    <span className="font-mono text-[#202020]">
                      {activeLead.marriage_anniversary}
                    </span>
                  </div>
                )}

                {activeLead.address && (
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-mono uppercase text-[#828282] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#828282]" /> Residential Address
                    </span>
                    <span className="text-[#202020]">{activeLead.address}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pipeline Stage */}
          <div className="border border-[#e8e8e8] p-4 bg-white rounded">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#202020] font-semibold mb-3">
              Pipeline Stage
            </h3>

            <select
              id="lead-status-select"
              value={activeLead.status}
              onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
              className="w-full text-xs p-2.5 border border-[#e8e8e8] rounded bg-[#ffffff] text-[#202020] font-mono focus:outline-none focus:border-[#202020]"
            >
              {!PIPELINE_STAGES.includes(activeLead.status) && (
                <option value={activeLead.status} disabled>
                  {activeLead.status}
                </option>
              )}
              {PIPELINE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>

          {/* Close Lead */}
          <div className="border border-[#e8e8e8] p-4 bg-white rounded">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#202020] font-semibold mb-3">
              Close Lead
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                id="mark-lead-won-btn"
                type="button"
                onClick={() => handleStatusChange('Closed Won')}
                disabled={activeLead.status === 'Closed Won'}
                className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-medium transition-colors rounded flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Success</span>
              </button>
              <button
                id="mark-lead-lost-btn"
                type="button"
                onClick={() => handleStatusChange('Closed Lost')}
                disabled={activeLead.status === 'Closed Lost'}
                className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-medium transition-colors rounded flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Mark Failed</span>
              </button>
            </div>
          </div>

          {/* Quick Log Interaction Form */}
          <div className="border border-[#e8e8e8] p-4 bg-white rounded">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#202020] font-semibold mb-3 flex items-center justify-between">
              <span>Log Interaction / Call Notes</span>
              <span className="text-[10px] font-normal text-[#828282]">
                Fast Sales Capture
              </span>
            </h3>

            {feedback && (
              <div
                className={`mb-3 p-2.5 border text-xs rounded flex items-center gap-1.5 ${
                  feedbackIsError
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {feedbackIsError ? (
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
                <span>{feedback}</span>
              </div>
            )}

            <form onSubmit={handleLogInteraction} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                  Interaction Channel
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      'Phone Call',
                      'WhatsApp',
                      'Site Visit',
                      'In-Person Meeting',
                      'Email',
                    ] as InteractionType[]
                  ).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setInteractionType(type)}
                      className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                        interactionType === type
                          ? 'bg-[#202020] text-white'
                          : 'bg-[#efefef] text-[#4d4d4d] hover:bg-[#e4e4e4]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                  Discussion Notes & Observations
                </label>
                <textarea
                  required
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="e.g. Client liked the terrace view, requested 2nd visit on Saturday, concerned about parking."
                  className="w-full text-xs p-2.5 border border-[#e8e8e8] rounded bg-[#ffffff] text-[#202020] focus:outline-none focus:border-[#202020]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#828282] mb-1">
                    Set Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={nextFollowupDate}
                    onChange={(e) => setNextFollowupDate(e.target.value)}
                    className="w-full text-xs p-2 border border-[#e8e8e8] rounded bg-[#ffffff] text-[#202020] focus:outline-none focus:border-[#202020]"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    id="submit-log-note-btn"
                    type="submit"
                    disabled={isSubmitting || !noteText.trim()}
                    className="w-full py-2 px-3 bg-[#202020] text-white text-xs font-medium hover:bg-black transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3 text-[#ff682c]" />
                    <span>{isSubmitting ? 'Saving...' : 'Record Notes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Activity Timeline */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#202020] font-semibold mb-3">
              Conversation History ({leadInteractions.length})
            </h3>

            {leadInteractions.length === 0 ? (
              <p className="text-xs text-[#828282] font-mono py-3">
                No interaction records logged yet.
              </p>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-[#e8e8e8]">
                {leadInteractions.map((item) => (
                  <div key={item.id} className="relative pl-7 text-xs">
                    <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-[#efefef] border border-[#828282]" />
                    <div className="bg-[#efefef] p-3 rounded border border-[#e8e8e8]">
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#828282] mb-1">
                        <span className="font-semibold text-[#202020]">
                          {item.interaction_type}
                        </span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-[#202020] whitespace-pre-wrap">{item.notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scheduled Follow-ups */}
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#202020] font-semibold mb-3">
              Scheduled Follow-ups ({leadFollowups.length})
            </h3>
            {leadFollowups.length === 0 ? (
              <p className="text-xs text-[#828282] font-mono py-2">
                No follow-ups scheduled for this lead.
              </p>
            ) : (
              <div className="space-y-2">
                {leadFollowups.map((fup) => (
                  <div
                    key={fup.id}
                    className="p-3 bg-[#ffffff] border border-[#e8e8e8] rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-[#ff682c]" />
                        <span className="font-semibold text-[#202020]">
                          {fup.followup_date}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            fup.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {fup.status}
                        </span>
                      </div>
                      {fup.notes && (
                        <p className="text-[#4d4d4d] text-[11px] mt-1">{fup.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger Zone — last, so destructive controls are never adjacent to
              the everyday ones */}
          {canManage && (
            <div className="border border-[#e8e8e8] rounded-lg p-4">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#828282] mb-2.5 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                Danger Zone
              </h3>

              {showDeleteConfirm ? (
                <div className="space-y-2">
                  <div className="p-2.5 bg-red-50 border border-red-200 text-[11px] text-red-700 rounded flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Delete {activeLead.name} permanently? The lead, its{' '}
                      {leadInteractions.length} interaction note
                      {leadInteractions.length === 1 ? '' : 's'} and its{' '}
                      {leadFollowups.length} follow-up
                      {leadFollowups.length === 1 ? '' : 's'} will be removed. This
                      cannot be undone.
                    </span>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 text-xs font-mono text-[#4d4d4d] hover:bg-[#efefef] rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      id="confirm-delete-lead-btn"
                      type="button"
                      onClick={handleDeleteLead}
                      disabled={isDeleting}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-medium transition-colors rounded disabled:opacity-50"
                    >
                      {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id="delete-lead-btn"
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Lead
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
