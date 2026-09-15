'use client';

import React, { useState } from 'react';
import { Lead, InteractionType } from '@/lib/types';
import { useCRM } from '@/lib/crmContext';
import {
  X,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  Home,
  MapPin,
  Gift,
  Heart,
  DollarSign,
  Send,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

interface LeadDetailsDrawerProps {
  lead: Lead | null;
  onClose: () => void;
}

export default function LeadDetailsDrawer({ lead, onClose }: LeadDetailsDrawerProps) {
  const { interactions, followups, logInteraction, profiles, currentUser } = useCRM();

  const [noteText, setNoteText] = useState('');
  const [interactionType, setInteractionType] = useState<InteractionType>('Phone Call');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!lead) return null;

  // Filter interactions and followups specifically for this lead
  const leadInteractions = interactions.filter((i) => i.lead_id === lead.id);
  const leadFollowups = followups.filter((f) => f.lead_id === lead.id);
  const assignedRep = profiles.find((p) => p.id === lead.assigned_rep_id);

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setIsSubmitting(true);
    await logInteraction({
      lead_id: lead.id,
      notes: noteText.trim(),
      interaction_type: interactionType,
      nextFollowupDate: nextFollowupDate || undefined,
      nextFollowupNotes: `Follow-up after ${interactionType}`,
    });

    setNoteText('');
    setNextFollowupDate('');
    setIsSubmitting(false);
    setFeedback('Interaction logged and follow-up updated!');
    setTimeout(() => setFeedback(null), 3500);
  };

  const cleanPhone1 = lead.phone_1.replace(/[^0-9+]/g, '');

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
                {lead.status}
              </span>
              <span className="text-xs font-mono text-[#828282]">
                ID: {lead.id.slice(-6)}
              </span>
            </div>
            <h2 className="text-xl font-normal text-[#202020] tracking-tight truncate">
              {lead.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[#4d4d4d] mt-1 font-mono truncate">
              <Home className="w-3.5 h-3.5 text-[#ff682c] shrink-0" />
              <span className="font-semibold text-[#202020] truncate">{lead.preferred_property}</span>
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
              lead.name
            )},%20following%20up%20from%20Wonder%20regarding%20${encodeURIComponent(lead.preferred_property)}.`}
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
          {/* Metadata Grid */}
          <div className="bg-[#f5f5f5] p-4 rounded border border-[#e8e8e8] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase text-[#828282] block">
                Primary Phone
              </span>
              <span className="font-mono text-sm text-[#202020]">{lead.phone_1}</span>
            </div>

            {lead.mobile_2 && (
              <div>
                <span className="text-[10px] font-mono uppercase text-[#828282] block">
                  Secondary Mobile
                </span>
                <span className="font-mono text-sm text-[#202020]">{lead.mobile_2}</span>
              </div>
            )}

            {lead.budget && (
              <div>
                <span className="text-[10px] font-mono uppercase text-[#828282] block">
                  Budget
                </span>
                <span className="font-medium text-[#202020]">{lead.budget}</span>
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

            {lead.dob && (
              <div>
                <span className="text-[10px] font-mono uppercase text-[#828282] flex items-center gap-1">
                  <Gift className="w-3 h-3 text-[#ff682c]" /> Date of Birth (DOB)
                </span>
                <span className="font-mono text-[#202020]">{lead.dob}</span>
              </div>
            )}

            {lead.marriage_anniversary && (
              <div>
                <span className="text-[10px] font-mono uppercase text-[#828282] flex items-center gap-1">
                  <Heart className="w-3 h-3 text-[#ff682c]" /> Marriage Anniversary
                </span>
                <span className="font-mono text-[#202020]">
                  {lead.marriage_anniversary}
                </span>
              </div>
            )}

            {lead.address && (
              <div className="sm:col-span-2">
                <span className="text-[10px] font-mono uppercase text-[#828282] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#828282]" /> Residential Address
                </span>
                <span className="text-[#202020]">{lead.address}</span>
              </div>
            )}
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
              <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
        </div>
      </div>
    </div>
  );
}
