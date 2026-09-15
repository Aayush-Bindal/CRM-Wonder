'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Profile,
  Lead,
  LeadStatus,
  Interaction,
  Followup,
  UserRole,
  InteractionType,
} from './types';
import { getTodayDateStr } from './utils';
import { getSupabaseClient, getSupabaseConfig } from './supabase/client';

interface CRMContextType {
  currentUser: Profile | null;
  profiles: Profile[];
  leads: Lead[];
  interactions: Interaction[];
  followups: Followup[];
  isSupabaseConfigured: boolean;
  isLoading: boolean;
  activeRole: UserRole | null;

  // RLS already scopes these server-side, kept as aliases for consumers
  visibleLeads: Lead[];
  visibleFollowups: Followup[];
  visibleInteractions: Interaction[];
  todayPriorityFollowups: Followup[];

  // Auth
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Operations
  addLead: (data: {
    name: string;
    phone_1: string;
    mobile_2?: string;
    address?: string;
    dob?: string;
    marriage_anniversary?: string;
    preferred_property: string;
    budget?: string;
    assigned_rep_id?: string;
    initialNotes?: string;
    nextFollowupDate?: string;
  }) => Promise<{ lead: Lead | null; success: boolean; error?: string }>;

  logInteraction: (data: {
    lead_id: string;
    notes: string;
    interaction_type: InteractionType;
    nextFollowupDate?: string;
    nextFollowupNotes?: string;
  }) => Promise<boolean>;

  completeFollowup: (followupId: string, resolutionNotes?: string) => Promise<boolean>;
  rescheduleFollowup: (followupId: string, newDate: string, notes?: string) => Promise<boolean>;
  reassignLead: (leadId: string, newRepId: string) => Promise<boolean>;
  updateLeadStatus: (leadId: string, status: LeadStatus) => Promise<boolean>;
  createRepAccount: (data: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
  }) => Promise<{ success: boolean; error?: string }>;
  resetUserPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isSupabaseConfigured] = useState<boolean>(() => {
    const config = getSupabaseConfig();
    return Boolean(config.url && config.key);
  });

  const loadData = useCallback(async (userId: string) => {
    const client = getSupabaseClient();
    if (!client) return;

    const [profileRes, profilesRes, leadsRes, interactionsRes, followupsRes] = await Promise.all([
      client.from('profiles').select('*').eq('id', userId).single(),
      client.from('profiles').select('*').order('full_name', { ascending: true }),
      client.from('leads').select('*').order('created_at', { ascending: false }),
      client.from('interactions').select('*').order('created_at', { ascending: false }),
      client.from('followups').select('*').order('followup_date', { ascending: true }),
    ]);

    setCurrentUser((profileRes.data as Profile) || null);
    setProfiles((profilesRes.data as Profile[]) || []);
    setLeads((leadsRes.data as Lead[]) || []);
    setInteractions((interactionsRes.data as Interaction[]) || []);
    setFollowups((followupsRes.data as Followup[]) || []);
  }, []);

  const clearData = useCallback(() => {
    setCurrentUser(null);
    setProfiles([]);
    setLeads([]);
    setInteractions([]);
    setFollowups([]);
  }, []);

  // Track the signed-in session and (re)load data whenever it changes
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setIsLoading(false);
      return;
    }

    let didInit = false;

    const { data: listener } = client.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadData(session.user.id);
      } else {
        clearData();
      }
      if (!didInit) {
        didInit = true;
        setIsLoading(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadData, clearData]);

  const visibleLeads = leads;
  const visibleFollowups = followups;
  const visibleInteractions = interactions;

  const todayPriorityFollowups = React.useMemo(() => {
    const todayStr = getTodayDateStr();
    return followups.filter((f) => f.followup_date === todayStr && f.status === 'Pending');
  }, [followups]);

  // Sign in with email + password
  const login = useCallback(
    async (identifier: string, password: string): Promise<{ success: boolean; error?: string }> => {
      const client = getSupabaseClient();
      if (!client) {
        return { success: false, error: 'Supabase is not configured.' };
      }

      const email = identifier.trim();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        return {
          success: false,
          error:
            error.message === 'Invalid login credentials'
              ? 'Incorrect email/phone or password.'
              : error.message,
        };
      }

      return { success: true };
    },
    []
  );

  const logout = useCallback(async () => {
    const client = getSupabaseClient();
    if (client) await client.auth.signOut();
  }, []);

  const addLead = useCallback(
    async (data: {
      name: string;
      phone_1: string;
      mobile_2?: string;
      address?: string;
      dob?: string;
      marriage_anniversary?: string;
      preferred_property: string;
      budget?: string;
      assigned_rep_id?: string;
      initialNotes?: string;
      nextFollowupDate?: string;
    }) => {
      const client = getSupabaseClient();
      if (!client || !currentUser) {
        return { lead: null, success: false, error: 'Not authenticated.' };
      }

      const repId = data.assigned_rep_id || currentUser.id;

      const { data: inserted, error } = await client
        .from('leads')
        .insert({
          name: data.name.trim(),
          phone_1: data.phone_1.trim(),
          mobile_2: data.mobile_2?.trim() || null,
          address: data.address?.trim() || null,
          dob: data.dob || null,
          marriage_anniversary: data.marriage_anniversary || null,
          preferred_property: data.preferred_property.trim(),
          budget: data.budget?.trim() || null,
          assigned_rep_id: repId,
          status: 'New',
        })
        .select()
        .single();

      if (error || !inserted) {
        return { lead: null, success: false, error: error?.message || 'Failed to create lead.' };
      }

      const newLead = inserted as Lead;
      setLeads((prev) => [newLead, ...prev]);

      if (data.initialNotes && data.initialNotes.trim()) {
        const { data: interactionRow } = await client
          .from('interactions')
          .insert({
            lead_id: newLead.id,
            rep_id: repId,
            notes: data.initialNotes.trim(),
            interaction_type: 'Phone Call',
          })
          .select()
          .single();
        if (interactionRow) setInteractions((prev) => [interactionRow as Interaction, ...prev]);
      }

      if (data.nextFollowupDate) {
        const { data: followupRow } = await client
          .from('followups')
          .insert({
            lead_id: newLead.id,
            rep_id: repId,
            followup_date: data.nextFollowupDate,
            status: 'Pending',
            notes: `Follow up regarding ${data.preferred_property}`,
          })
          .select()
          .single();
        if (followupRow) setFollowups((prev) => [followupRow as Followup, ...prev]);
      }

      return { lead: newLead, success: true };
    },
    [currentUser]
  );

  const logInteraction = useCallback(
    async (data: {
      lead_id: string;
      notes: string;
      interaction_type: InteractionType;
      nextFollowupDate?: string;
      nextFollowupNotes?: string;
    }) => {
      const client = getSupabaseClient();
      if (!client || !currentUser) return false;

      const { data: interactionRow, error } = await client
        .from('interactions')
        .insert({
          lead_id: data.lead_id,
          rep_id: currentUser.id,
          notes: data.notes.trim(),
          interaction_type: data.interaction_type,
        })
        .select()
        .single();

      if (error || !interactionRow) return false;
      setInteractions((prev) => [interactionRow as Interaction, ...prev]);

      if (data.nextFollowupDate) {
        const { data: followupRow } = await client
          .from('followups')
          .insert({
            lead_id: data.lead_id,
            rep_id: currentUser.id,
            followup_date: data.nextFollowupDate,
            status: 'Pending',
            notes: data.nextFollowupNotes?.trim() || `Follow-up after ${data.interaction_type}`,
          })
          .select()
          .single();
        if (followupRow) setFollowups((prev) => [followupRow as Followup, ...prev]);
      }

      return true;
    },
    [currentUser]
  );

  const completeFollowup = useCallback(
    async (followupId: string, resolutionNotes?: string) => {
      const client = getSupabaseClient();
      if (!client) return false;

      const existing = followups.find((f) => f.id === followupId);
      const newNotes = resolutionNotes
        ? `${existing?.notes || ''} [Completed]: ${resolutionNotes}`
        : existing?.notes;

      const { data: updated, error } = await client
        .from('followups')
        .update({ status: 'Completed', completed_at: new Date().toISOString(), notes: newNotes })
        .eq('id', followupId)
        .select()
        .single();

      if (error || !updated) return false;
      setFollowups((prev) => prev.map((f) => (f.id === followupId ? (updated as Followup) : f)));
      return true;
    },
    [followups]
  );

  const rescheduleFollowup = useCallback(async (followupId: string, newDate: string, notes?: string) => {
    const client = getSupabaseClient();
    if (!client) return false;

    const updates: { followup_date: string; notes?: string } = { followup_date: newDate };
    if (notes) updates.notes = notes;

    const { data: updated, error } = await client
      .from('followups')
      .update(updates)
      .eq('id', followupId)
      .select()
      .single();

    if (error || !updated) return false;
    setFollowups((prev) => prev.map((f) => (f.id === followupId ? (updated as Followup) : f)));
    return true;
  }, []);

  const reassignLead = useCallback(async (leadId: string, newRepId: string) => {
    const client = getSupabaseClient();
    if (!client) return false;

    const { data: updatedLead, error } = await client
      .from('leads')
      .update({ assigned_rep_id: newRepId })
      .eq('id', leadId)
      .select()
      .single();

    if (error || !updatedLead) return false;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? (updatedLead as Lead) : l)));

    const { data: updatedFups } = await client
      .from('followups')
      .update({ rep_id: newRepId })
      .eq('lead_id', leadId)
      .eq('status', 'Pending')
      .select();

    if (updatedFups) {
      const fups = updatedFups as Followup[];
      setFollowups((prev) => prev.map((f) => fups.find((u) => u.id === f.id) || f));
    }

    return true;
  }, []);

  const updateLeadStatus = useCallback(async (leadId: string, status: LeadStatus) => {
    const client = getSupabaseClient();
    if (!client) return false;

    const { data: updated, error } = await client
      .from('leads')
      .update({ status })
      .eq('id', leadId)
      .select()
      .single();

    if (error || !updated) return false;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? (updated as Lead) : l)));
    return true;
  }, []);

  // Admin-only: provisions a new team member via a server-side route (needs the service role key)
  const createRepAccount = useCallback(
    async (data: { full_name: string; email: string; phone: string; password: string; role: UserRole }) => {
      const client = getSupabaseClient();
      if (!client) return { success: false, error: 'Supabase is not configured.' };

      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return { success: false, error: 'Not authenticated.' };

      try {
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) {
          return { success: false, error: result.error || 'Failed to create account.' };
        }
        if (result.profile) {
          setProfiles((prev) => [...prev, result.profile as Profile]);
        }
        return { success: true };
      } catch {
        return { success: false, error: 'Unable to reach the server. Please try again.' };
      }
    },
    []
  );

  // Admin-only: sets a new password for a team member (real auth can't reveal the old one)
  const resetUserPassword = useCallback(async (userId: string, newPassword: string) => {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const { data: sessionData } = await client.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { success: false, error: 'Not authenticated.' };

    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId, newPassword }),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || 'Failed to reset password.' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Unable to reach the server. Please try again.' };
    }
  }, []);

  // Admin-only: permanently deletes a team member's account
  const deleteUser = useCallback(async (userId: string) => {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const { data: sessionData } = await client.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { success: false, error: 'Not authenticated.' };

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId }),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || 'Failed to delete user.' };
      }
      setProfiles((prev) => prev.filter((p) => p.id !== userId));
      return { success: true };
    } catch {
      return { success: false, error: 'Unable to reach the server. Please try again.' };
    }
  }, []);

  return (
    <CRMContext.Provider
      value={{
        currentUser,
        profiles,
        leads,
        interactions,
        followups,
        isSupabaseConfigured,
        isLoading,
        activeRole: currentUser?.role || null,
        visibleLeads,
        visibleFollowups,
        visibleInteractions,
        todayPriorityFollowups,
        login,
        logout,
        addLead,
        logInteraction,
        completeFollowup,
        rescheduleFollowup,
        reassignLead,
        updateLeadStatus,
        createRepAccount,
        resetUserPassword,
        deleteUser,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
}
