'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Profile,
  Lead,
  LeadStatus,
  Interaction,
  Followup,
  UserRole,
  InteractionType,
  LeadEditableFields,
} from './types';
import { getTodayDateStr, isPhoneNumber, normalizeTenDigitPhone } from './utils';
import { getSupabaseClient, getSupabaseConfig } from './supabase/client';

interface CRMContextType {
  currentUser: Profile | null;
  profiles: Profile[];
  leads: Lead[];
  interactions: Interaction[];
  followups: Followup[];
  isSupabaseConfigured: boolean;
  // True until the session check has settled: the first auth event, plus the
  // profile row when that event carried a session. Screens must not choose
  // between the CRM and the sign-in form while this is still up.
  isLoading: boolean;
  activeRole: UserRole | null;

  // Scoped to the signed-in user: RLS already filters server-side, but the UI
  // must not depend on the database being the only thing standing between a rep
  // and another rep's customer records.
  visibleLeads: Lead[];
  visibleFollowups: Followup[];
  visibleInteractions: Interaction[];
  todayPriorityFollowups: Followup[];

  // Set when a session was refused or revoked (e.g. a deactivated account).
  authNotice: string | null;

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
    // null = capture without an owner (Admin only); undefined = the caller's own
    // profile, the rep's normal path.
    assigned_rep_id?: string | null;
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
  reassignLead: (leadId: string, newRepId: string) => Promise<{ success: boolean; error?: string }>;
  updateLeadStatus: (leadId: string, status: LeadStatus) => Promise<boolean>;
  // Correct a lead captured by mistake. Permitted for the lead's owner and for
  // Admins; enforced by the column grants and RLS, not by the UI.
  updateLead: (leadId: string, patch: LeadEditableFields) => Promise<{ success: boolean; error?: string }>;
  // Removes the lead and, by cascade, its interactions and follow-ups.
  deleteLead: (leadId: string) => Promise<{ success: boolean; error?: string }>;
  createRepAccount: (data: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
  }) => Promise<{ success: boolean; error?: string }>;
  resetUserPassword: (
    userId: string,
    newPassword: string,
    adminPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string, adminPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

// Why a session was refused, carried across the redirect to /login. The
// provider that raised it is unmounted on the way there, and an explanation
// that vanishes with it is no explanation at all.
const AUTH_NOTICE_KEY = 'wonder:auth-notice';

function readStoredAuthNotice(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(AUTH_NOTICE_KEY);
  } catch {
    return null;
  }
}

function storeAuthNotice(notice: string | null): void {
  try {
    if (notice) window.sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
    else window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
  } catch {
    // Storage refused (private mode, blocked cookies): the notice is simply not
    // carried across, which is how it behaved before it was persisted at all.
  }
}

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [authNotice, setAuthNoticeState] = useState<string | null>(readStoredAuthNotice);

  const setAuthNotice = useCallback((notice: string | null) => {
    setAuthNoticeState(notice);
    storeAuthNotice(notice);
  }, []);

  const [isSupabaseConfigured] = useState<boolean>(() => {
    const config = getSupabaseConfig();
    return Boolean(config.url && config.key);
  });
  // Which identity the session check has settled on: null while it is still in
  // flight, '' once it is over with nobody signed in, otherwise the user id.
  //
  // A plain boolean cannot carry this. The session is only half the answer —
  // until the profile row comes back there is no user to render, so a flag that
  // drops as soon as the auth event arrives shows the signed-out screen to a
  // signed-in visitor for the length of that round trip, on every visit.
  const [settledUserId, setSettledUserId] = useState<string | null>(
    isSupabaseConfigured ? null : ''
  );
  // With no client configured there is nothing to wait for.
  const isLoading = settledUserId === null;

  // Identity the in-flight load belongs to. Every write is gated on this so a
  // slow response from a previous user can never overwrite the current session.
  const activeUserIdRef = useRef<string | null>(null);

  // Signed out — or signed out because the session was refused. Either way
  // there is no identity left to wait for, so the check settles here as well
  // and no caller has to track that separately.
  const clearData = useCallback(() => {
    setCurrentUser(null);
    setProfiles([]);
    setLeads([]);
    setInteractions([]);
    setFollowups([]);
    setSettledUserId('');
  }, []);

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

    // A newer auth event superseded this load (sign-out, or a different user):
    // drop the result instead of writing another identity's rows into state.
    if (activeUserIdRef.current !== userId) return;

    const profile = (profileRes.data as Profile) || null;

    // Both cases below revoke the session: every RLS policy requires an active
    // profile row, so the app would otherwise render as an unusable shell. They
    // are reported separately because they need different fixes — a missing row
    // means the login was never provisioned (or was created before the schema
    // existed), while an inactive row means it was deliberately turned off.
    if (!profile) {
      activeUserIdRef.current = null;
      setAuthNotice(
        'This login has no CRM profile yet, so it cannot be used. An administrator must provision it.'
      );
      await client.auth.signOut();
      return;
    }

    if (!profile.is_active) {
      activeUserIdRef.current = null;
      setAuthNotice('This account is inactive. Contact your administrator.');
      await client.auth.signOut();
      return;
    }

    setCurrentUser(profile);
    setProfiles((profilesRes.data as Profile[]) || []);
    setLeads((leadsRes.data as Lead[]) || []);
    setInteractions((interactionsRes.data as Interaction[]) || []);
    setFollowups((followupsRes.data as Followup[]) || []);
    // Same synchronous block as the writes above, so the render that ends the
    // settling state is also the one that has the user to put on screen.
    setSettledUserId(userId);
  }, [setAuthNotice]);

  // Track the signed-in session and (re)load data whenever it changes
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      activeUserIdRef.current = userId;

      // Both branches settle the check themselves — loadData once it holds the
      // profile, clearData immediately — so nothing downstream has to guess
      // when it is safe to render.
      if (userId) {
        void loadData(userId).catch(() => {
          // A failed load must not leave the boot state up forever.
          if (activeUserIdRef.current === userId) clearData();
        });
      } else {
        clearData();
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadData, clearData]);

  const isAdmin = currentUser?.role === 'Admin';

  const visibleLeads = React.useMemo(
    () =>
      isAdmin || !currentUser
        ? leads
        : leads.filter((l) => l.assigned_rep_id === currentUser.id),
    [leads, isAdmin, currentUser]
  );
  const visibleFollowups = React.useMemo(
    () =>
      isAdmin || !currentUser
        ? followups
        : followups.filter((f) => f.rep_id === currentUser.id),
    [followups, isAdmin, currentUser]
  );
  const visibleInteractions = React.useMemo(
    () =>
      isAdmin || !currentUser
        ? interactions
        : interactions.filter((i) => i.rep_id === currentUser.id),
    [interactions, isAdmin, currentUser]
  );

  // Pending items due today or earlier: a missed follow-up is carried forward in
  // the priority queue until it is completed or rescheduled.
  const todayPriorityFollowups = React.useMemo(() => {
    const todayStr = getTodayDateStr();
    return visibleFollowups.filter(
      (f) => f.status === 'Pending' && f.followup_date <= todayStr
    );
  }, [visibleFollowups]);

  // Sign in with email + password
  const login = useCallback(
    async (identifier: string, password: string): Promise<{ success: boolean; error?: string }> => {
      const client = getSupabaseClient();
      if (!client) {
        return { success: false, error: 'Supabase is not configured.' };
      }

      setAuthNotice(null);

      const email = identifier.trim();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        // One message for every failure: distinguishing "Email not confirmed"
        // from "Invalid login credentials" tells an attacker which addresses
        // exist. The provider detail goes to the console, not the UI.
        console.warn('[auth] sign-in failed', { code: error.code, message: error.message });
        return { success: false, error: 'Incorrect email or password.' };
      }

      return { success: true };
    },
    [setAuthNotice]
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
      // null = capture without an owner (Admin only); undefined = the caller's
      // own profile, the rep's normal path.
      assigned_rep_id?: string | null;
      initialNotes?: string;
      nextFollowupDate?: string;
    }) => {
      const client = getSupabaseClient();
      if (!client || !currentUser) {
        return { lead: null, success: false, error: 'Not authenticated.' };
      }

      const phone1 = data.phone_1.trim();
      const mobile2 = data.mobile_2?.trim() || '';
      if (!isPhoneNumber(phone1) || (mobile2 && !isPhoneNumber(mobile2))) {
        return { lead: null, success: false, error: 'Phone numbers must contain exactly 10 digits.' };
      }

      // One lead per person. The database enforces this too (unique index on the
      // last 10 digits), but checking first turns a raw constraint error into a
      // sentence, and sees leads already loaded in this session.
      const duplicate = leads.find(
        (lead) => normalizeTenDigitPhone(lead.phone_1) === phone1
      );
      if (duplicate) {
        return {
          lead: null,
          success: false,
          error: `A lead with this phone number already exists: ${duplicate.name}.`,
        };
      }

      // null stays null: an Admin may capture a walk-in without an owner.
      const repId =
        data.assigned_rep_id === null ? null : data.assigned_rep_id || currentUser.id;

      const { data: inserted, error } = await client
        .from('leads')
        .insert({
          name: data.name.trim(),
          phone_1: phone1,
          mobile_2: mobile2 || null,
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

      // The lead is saved at this point; the note and follow-up are best-effort
      // extras. Report a partial failure instead of claiming success, so the
      // caller does not close the form and lose the typed note.
      if (data.initialNotes && data.initialNotes.trim()) {
        // Asked to act: authorship is the signed-in user, ownership is the
        // assignee. Recording the assignee as the author forges the audit trail
        // (an admin capturing a note for rep R would appear as R's own call).
        const { data: interactionRow, error: interactionError } = await client
          .from('interactions')
          .insert({
            lead_id: newLead.id,
            rep_id: currentUser.id,
            notes: data.initialNotes.trim(),
            interaction_type: 'Phone Call',
          })
          .select()
          .single();
        if (interactionError) {
          return {
            lead: newLead,
            success: false,
            error: `Lead saved, but the first note could not be logged: ${interactionError.message}`,
          };
        }
        if (interactionRow) setInteractions((prev) => [interactionRow as Interaction, ...prev]);
      }

      // followups.rep_id is NOT NULL, so an unassigned lead cannot carry one yet.
      if (data.nextFollowupDate && repId) {
        const { data: followupRow, error: followupError } = await client
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
        if (followupError) {
          return {
            lead: newLead,
            success: false,
            error: `Lead saved, but the follow-up could not be scheduled: ${followupError.message}`,
          };
        }
        if (followupRow) setFollowups((prev) => [followupRow as Followup, ...prev]);
      }

      return { lead: newLead, success: true };
    },
    [currentUser, leads]
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
        const { data: followupRow, error: followupError } = await client
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
        if (followupError) {
          console.error('[crm] follow-up insert failed', followupError.message);
          return false;
        }
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

  // Admin-only: one atomic statement in the database (public.reassign_lead)
  // instead of two client-side updates, which could leave pending follow-ups
  // owned by the previous rep while the lead already belonged to the new one.
  const reassignLead = useCallback(async (leadId: string, newRepId: string) => {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const { error } = await client.rpc('reassign_lead', {
      p_lead_id: leadId,
      p_new_rep_id: newRepId,
    });

    if (error) {
      console.error('[crm] reassign_lead failed', error.message);
      return { success: false, error: error.message };
    }

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, assigned_rep_id: newRepId } : l))
    );
    setFollowups((prev) =>
      prev.map((f) =>
        f.lead_id === leadId && f.status === 'Pending' ? { ...f, rep_id: newRepId } : f
      )
    );

    return { success: true };
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

  // Correct a lead's captured details. A zero-row result means the write was
  // filtered out by RLS (the lead is no longer the caller's), which is reported
  // rather than swallowed — a silently ignored save is how bad data survives.
  const updateLead = useCallback(
    async (leadId: string, patch: LeadEditableFields) => {
      const client = getSupabaseClient();
      if (!client) return { success: false, error: 'Supabase is not configured.' };

      if (!patch.name?.trim() || !patch.phone_1?.trim() || !patch.preferred_property?.trim()) {
        return { success: false, error: 'Name, primary phone and property are required.' };
      }

      const phone1 = patch.phone_1.trim();
      const mobile2 = patch.mobile_2?.trim() || '';
      if (!isPhoneNumber(phone1) || (mobile2 && !isPhoneNumber(mobile2))) {
        return { success: false, error: 'Phone numbers must contain exactly 10 digits.' };
      }

      // Correcting a typo must not turn into a second record for a person who
      // is already in the CRM (the unique index would reject it anyway).
      const duplicate = leads.find(
        (lead) => lead.id !== leadId && normalizeTenDigitPhone(lead.phone_1) === phone1
      );
      if (duplicate) {
        return {
          success: false,
          error: `A lead with this phone number already exists: ${duplicate.name}.`,
        };
      }

      const { data: updated, error } = await client
        .from('leads')
        .update({
          name: patch.name.trim(),
          phone_1: phone1,
          mobile_2: mobile2 || null,
          address: patch.address?.trim() || null,
          dob: patch.dob || null,
          marriage_anniversary: patch.marriage_anniversary || null,
          preferred_property: patch.preferred_property.trim(),
          budget: patch.budget?.trim() || null,
        })
        .eq('id', leadId)
        .select()
        .single();

      if (error) {
        console.error('[crm] lead update failed', error.message);
        return { success: false, error: error.message };
      }
      if (!updated) {
        return {
          success: false,
          error: 'This lead could not be updated — it may no longer be assigned to you.',
        };
      }

      setLeads((prev) => prev.map((l) => (l.id === leadId ? (updated as Lead) : l)));
      return { success: true };
    },
    [leads]
  );

  // Delete a lead captured by mistake. The database removes its interactions and
  // follow-ups too (ON DELETE CASCADE).
  const deleteLead = useCallback(async (leadId: string) => {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase is not configured.' };

    const { error, count } = await client
      .from('leads')
      .delete({ count: 'exact' })
      .eq('id', leadId);

    if (error) {
      console.error('[crm] lead delete failed', error.message);
      return { success: false, error: error.message };
    }
    if (!count) {
      return {
        success: false,
        error: 'This lead could not be deleted — it may no longer be assigned to you.',
      };
    }

    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setInteractions((prev) => prev.filter((i) => i.lead_id !== leadId));
    setFollowups((prev) => prev.filter((f) => f.lead_id !== leadId));
    return { success: true };
  }, []);

  // Attaches the admin bearer token and normalises the admin API contract.
  // These routes answer JSON, but an unhandled failure upstream returns Next's
  // HTML error page — calling res.json() on that throws and was previously
  // reported as "Unable to reach the server", hiding the real status.
  const callAdminApi = useCallback(
    async (
      path: string,
      payload: Record<string, unknown>
    ): Promise<{ success: boolean; error?: string; profile?: Profile }> => {
      const client = getSupabaseClient();
      if (!client) return { success: false, error: 'Supabase is not configured.' };

      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return { success: false, error: 'Not authenticated.' };

      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(payload),
        });

        const raw = await res.text();
        let message: string | undefined;
        try {
          const parsed = JSON.parse(raw) as { error?: string; profile?: Profile };
          message = parsed.error;
          if (parsed.profile) return { success: true, profile: parsed.profile };
        } catch {
          console.error('[crm] admin route returned a non-JSON body', path, res.status);
        }

        if (!res.ok) {
          return { success: false, error: message || `Request failed (${res.status}).` };
        }
        return { success: true };
      } catch {
        return { success: false, error: 'Unable to reach the server. Please try again.' };
      }
    },
    []
  );

  // Admin-only: provisions a new team member via a server-side route (needs the
  // service role key; the role travels in app_metadata, which only that route
  // can write — see supabase/migrations/20260916_security_hardening.sql).
  const createRepAccount = useCallback(
    async (data: { full_name: string; email: string; phone: string; password: string; role: UserRole }) => {
      const result = await callAdminApi('/api/admin/create-user', data);
      if (!result.success) return { success: false, error: result.error };
      if (result.profile) setProfiles((prev) => [...prev, result.profile as Profile]);
      return { success: true };
    },
    [callAdminApi]
  );

  // Admin-only, step-up authenticated: sets a new password for a team member
  // (real auth can't reveal the old one). The caller's own password is required.
  const resetUserPassword = useCallback(
    async (userId: string, newPassword: string, adminPassword: string) => {
      const { success, error } = await callAdminApi('/api/admin/reset-password', {
        userId,
        newPassword,
        adminPassword,
      });
      return { success, error };
    },
    [callAdminApi]
  );

  // Admin-only, step-up authenticated: permanently deletes a team member's account
  const deleteUser = useCallback(
    async (userId: string, adminPassword: string) => {
      const { success, error } = await callAdminApi('/api/admin/delete-user', {
        userId,
        adminPassword,
      });
      if (success) setProfiles((prev) => prev.filter((p) => p.id !== userId));
      return { success, error };
    },
    [callAdminApi]
  );

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
        authNotice,
        login,
        logout,
        addLead,
        logInteraction,
        completeFollowup,
        rescheduleFollowup,
        reassignLead,
        updateLeadStatus,
        updateLead,
        deleteLead,
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
