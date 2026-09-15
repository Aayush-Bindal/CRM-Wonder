'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Profile,
  Lead,
  Interaction,
  Followup,
  UserRole,
  InteractionType,
  FollowupStatus,
} from './types';
import {
  INITIAL_PROFILES,
  INITIAL_LEADS,
  INITIAL_INTERACTIONS,
  INITIAL_FOLLOWUPS,
  getTodayDateStr,
} from './mockData';
import { getSupabaseClient, getSupabaseConfig } from './supabase/client';

interface CRMContextType {
  currentUser: Profile | null;
  profiles: Profile[];
  leads: Lead[];
  interactions: Interaction[];
  followups: Followup[];
  isSupabaseConfigured: boolean;
  activeRole: UserRole | null;
  
  // RLS-scoped data helpers
  visibleLeads: Lead[];
  visibleFollowups: Followup[];
  visibleInteractions: Interaction[];
  todayPriorityFollowups: Followup[];
  
  // Actions
  loginAs: (profileId: string) => void;
  loginWithEmail: (email: string) => boolean;
  logout: () => void;
  
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
  }) => Promise<{ lead: Lead; success: boolean }>;
  
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
  createRepAccount: (data: { full_name: string; email: string; phone: string; role: UserRole }) => Promise<boolean>;
  
  // Edge Function & Automation simulation
  lastWebhookDispatched: { leadName: string; phone: string; timestamp: string; message: string } | null;
  clearWebhookNotification: () => void;
  runDailyCronCheck: () => {
    birthdaysFound: Lead[];
    anniversariesFound: Lead[];
    priorityCount: number;
    summaryText: string;
  };
}

function getLocalStorageItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch {
    return fallback;
  }
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Profile | null>(INITIAL_PROFILES[1]);
  const [profiles, setProfiles] = useState<Profile[]>(INITIAL_PROFILES);
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [interactions, setInteractions] = useState<Interaction[]>(INITIAL_INTERACTIONS);
  const [followups, setFollowups] = useState<Followup[]>(INITIAL_FOLLOWUPS);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Load from local storage safely once mounted on client to prevent hydration mismatch
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedUser = localStorage.getItem('estateflow_current_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.id) setCurrentUser(parsed);
        }
        const savedLeads = localStorage.getItem('estateflow_leads');
        if (savedLeads) {
          const parsed = JSON.parse(savedLeads);
          if (Array.isArray(parsed) && parsed.length > 0) setLeads(parsed);
        }
        const savedInts = localStorage.getItem('estateflow_interactions');
        if (savedInts) {
          const parsed = JSON.parse(savedInts);
          if (Array.isArray(parsed)) setInteractions(parsed);
        }
        const savedFups = localStorage.getItem('estateflow_followups');
        if (savedFups) {
          const parsed = JSON.parse(savedFups);
          if (Array.isArray(parsed)) setFollowups(parsed);
        }
        const savedProfiles = localStorage.getItem('estateflow_profiles');
        if (savedProfiles) {
          const parsed = JSON.parse(savedProfiles);
          if (Array.isArray(parsed) && parsed.length > 0) setProfiles(parsed);
        }
      } catch {
        // ignore error and keep initial defaults
      } finally {
        setIsStorageLoaded(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const [lastWebhookDispatched, setLastWebhookDispatched] = useState<{
    leadName: string;
    phone: string;
    timestamp: string;
    message: string;
  } | null>(null);

  const [isSupabaseConfigured] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const config = getSupabaseConfig();
    return Boolean(config && config.url && config.key);
  });

  // Save to local storage for persistence across reloads only after storage is loaded
  useEffect(() => {
    if (!isStorageLoaded) return;
    try {
      localStorage.setItem('estateflow_leads', JSON.stringify(leads));
      localStorage.setItem('estateflow_interactions', JSON.stringify(interactions));
      localStorage.setItem('estateflow_followups', JSON.stringify(followups));
      localStorage.setItem('estateflow_profiles', JSON.stringify(profiles));
      if (currentUser) {
        localStorage.setItem('estateflow_current_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('estateflow_current_user');
      }
    } catch {
      // ignore storage quota errors
    }
  }, [isStorageLoaded, leads, interactions, followups, profiles, currentUser]);

  // Mandatory RLS Simulation:
  // Reps must only be able to view, create, or update leads/interactions/followups assigned to their user_id.
  // Admins have full access across the entire system.
  const isAdmin = currentUser?.role === 'Admin';

  const visibleLeads = React.useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return leads;
    return leads.filter((l) => l.assigned_rep_id === currentUser.id);
  }, [leads, currentUser, isAdmin]);

  const visibleFollowups = React.useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return followups;
    return followups.filter((f) => f.rep_id === currentUser.id);
  }, [followups, currentUser, isAdmin]);

  const visibleInteractions = React.useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return interactions;
    return interactions.filter((i) => {
      // Direct rep attribution or on lead assigned to rep
      const lead = leads.find((l) => l.id === i.lead_id);
      return i.rep_id === currentUser.id || lead?.assigned_rep_id === currentUser.id;
    });
  }, [interactions, leads, currentUser, isAdmin]);

  // Today's Priority Followups: followup_date = TODAY and status = Pending
  const todayPriorityFollowups = React.useMemo(() => {
    const todayStr = getTodayDateStr();
    return visibleFollowups.filter(
      (f) => f.followup_date === todayStr && f.status === 'Pending'
    );
  }, [visibleFollowups]);

  const loginAs = useCallback(
    (profileId: string) => {
      // Direct account switching while an active session exists is disabled
      if (currentUser) {
        return;
      }
      const found = profiles.find((p) => p.id === profileId);
      if (found) {
        setCurrentUser(found);
      }
    },
    [currentUser, profiles]
  );

  const loginWithEmail = useCallback(
    (email: string) => {
      const found = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
      if (found) {
        setCurrentUser(found);
        return true;
      }
      return false;
    },
    [profiles]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  // Quick Add Lead: Captures details, optional note, and schedules followup in ONE workflow
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
      const repId = data.assigned_rep_id || currentUser?.id || profiles[1].id;
      const leadId = `lead-${Date.now()}`;
      const nowStr = new Date().toISOString();

      const newLead: Lead = {
        id: leadId,
        name: data.name.trim(),
        phone_1: data.phone_1.trim(),
        mobile_2: data.mobile_2?.trim() || '',
        address: data.address?.trim() || '',
        dob: data.dob || '',
        marriage_anniversary: data.marriage_anniversary || '',
        preferred_property: data.preferred_property.trim(),
        budget: data.budget?.trim() || '',
        assigned_rep_id: repId,
        status: 'New',
        created_at: nowStr,
        updated_at: nowStr,
      };

      // Add to leads
      setLeads((prev) => [newLead, ...prev]);

      // If initial note provided, create interaction
      if (data.initialNotes && data.initialNotes.trim()) {
        const newInt: Interaction = {
          id: `int-${Date.now()}`,
          lead_id: leadId,
          rep_id: repId,
          notes: data.initialNotes.trim(),
          interaction_type: 'Phone Call',
          created_at: nowStr,
        };
        setInteractions((prev) => [newInt, ...prev]);
      }

      // If followup date provided, create followup
      if (data.nextFollowupDate) {
        const newFup: Followup = {
          id: `fup-${Date.now()}`,
          lead_id: leadId,
          rep_id: repId,
          followup_date: data.nextFollowupDate,
          status: 'Pending',
          notes: `Follow up regarding ${data.preferred_property}`,
          created_at: nowStr,
        };
        setFollowups((prev) => [newFup, ...prev]);
      }

      // Trigger Edge Function Database Webhook Simulation: Instant "Thank You" message
      const repObj = profiles.find((p) => p.id === repId);
      const repName = repObj?.full_name || 'Property Advisor';
      const welcomeMsg = `Hello ${newLead.name}, thank you for inquiring about ${newLead.preferred_property}! Your dedicated advisor is ${repName}. We will connect shortly. - Luxury Living`;
      
      setLastWebhookDispatched({
        leadName: newLead.name,
        phone: newLead.phone_1,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        message: welcomeMsg,
      });

      // Try inserting to real Supabase if connected
      const client = getSupabaseClient();
      if (client) {
        try {
          await client.from('leads').insert({
            id: newLead.id,
            name: newLead.name,
            phone_1: newLead.phone_1,
            mobile_2: newLead.mobile_2,
            address: newLead.address,
            dob: newLead.dob || null,
            marriage_anniversary: newLead.marriage_anniversary || null,
            preferred_property: newLead.preferred_property,
            budget: newLead.budget,
            assigned_rep_id: newLead.assigned_rep_id,
            status: newLead.status,
          });
        } catch (e) {
          console.warn('Supabase remote insert fallback:', e);
        }
      }

      return { lead: newLead, success: true };
    },
    [currentUser, profiles]
  );

  // Log conversation interaction notes
  const logInteraction = useCallback(
    async (data: {
      lead_id: string;
      notes: string;
      interaction_type: InteractionType;
      nextFollowupDate?: string;
      nextFollowupNotes?: string;
    }) => {
      if (!currentUser) return false;
      const nowStr = new Date().toISOString();
      const intId = `int-${Date.now()}`;

      const newInt: Interaction = {
        id: intId,
        lead_id: data.lead_id,
        rep_id: currentUser.id,
        notes: data.notes.trim(),
        interaction_type: data.interaction_type,
        created_at: nowStr,
      };

      setInteractions((prev) => [newInt, ...prev]);

      // Update lead updated_at timestamp and status if appropriate
      setLeads((prev) =>
        prev.map((l) => (l.id === data.lead_id ? { ...l, updated_at: nowStr } : l))
      );

      // If next followup specified, create it
      if (data.nextFollowupDate) {
        const newFup: Followup = {
          id: `fup-${Date.now()}`,
          lead_id: data.lead_id,
          rep_id: currentUser.id,
          followup_date: data.nextFollowupDate,
          status: 'Pending',
          notes: data.nextFollowupNotes?.trim() || `Follow-up after ${data.interaction_type}`,
          created_at: nowStr,
        };
        setFollowups((prev) => [newFup, ...prev]);
      }

      return true;
    },
    [currentUser]
  );

  // Complete a followup
  const completeFollowup = useCallback(
    async (followupId: string, resolutionNotes?: string) => {
      const nowStr = new Date().toISOString();
      setFollowups((prev) =>
        prev.map((f) => {
          if (f.id === followupId) {
            return {
              ...f,
              status: 'Completed',
              completed_at: nowStr,
              notes: resolutionNotes ? `${f.notes || ''} [Completed]: ${resolutionNotes}` : f.notes,
            };
          }
          return f;
        })
      );
      return true;
    },
    []
  );

  // Reschedule followup
  const rescheduleFollowup = useCallback(
    async (followupId: string, newDate: string, notes?: string) => {
      setFollowups((prev) =>
        prev.map((f) => {
          if (f.id === followupId) {
            return {
              ...f,
              followup_date: newDate,
              notes: notes || f.notes,
            };
          }
          return f;
        })
      );
      return true;
    },
    []
  );

  // Admin reassigns lead to another sales rep
  const reassignLead = useCallback(
    async (leadId: string, newRepId: string) => {
      if (!isAdmin) return false;
      const nowStr = new Date().toISOString();

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, assigned_rep_id: newRepId, updated_at: nowStr } : l))
      );

      // Also transfer pending followups for this lead to the new rep
      setFollowups((prev) =>
        prev.map((f) => (f.lead_id === leadId && f.status === 'Pending' ? { ...f, rep_id: newRepId } : f))
      );

      return true;
    },
    [isAdmin]
  );

  // Admin provisions new Sales Rep
  const createRepAccount = useCallback(
    async (data: { full_name: string; email: string; phone: string; role: UserRole }) => {
      if (!isAdmin) return false;
      const nowStr = new Date().toISOString();
      const newProfile: Profile = {
        id: `usr-rep-${Date.now()}`,
        full_name: data.full_name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        role: data.role,
        is_active: true,
        created_at: nowStr,
        updated_at: nowStr,
      };

      setProfiles((prev) => [...prev, newProfile]);
      return true;
    },
    [isAdmin]
  );

  const clearWebhookNotification = useCallback(() => {
    setLastWebhookDispatched(null);
  }, []);

  // Run scheduled daily automation simulation
  const runDailyCronCheck = useCallback(() => {
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    const todayStr = getTodayDateStr();

    const birthdaysFound = leads.filter((l) => {
      if (!l.dob) return false;
      const parts = l.dob.split('-');
      return parts[1] === currentMonth && parts[2] === currentDay;
    });

    const anniversariesFound = leads.filter((l) => {
      if (!l.marriage_anniversary) return false;
      const parts = l.marriage_anniversary.split('-');
      return parts[1] === currentMonth && parts[2] === currentDay;
    });

    const priorityPending = followups.filter(
      (f) => f.followup_date === todayStr && f.status === 'Pending'
    );

    const summary = `Daily Automation executed: ${birthdaysFound.length} Birthday greetings, ${anniversariesFound.length} Anniversary greetings, and ${priorityPending.length} Today's Priority Follow-ups identified across the sales team.`;

    return {
      birthdaysFound,
      anniversariesFound,
      priorityCount: priorityPending.length,
      summaryText: summary,
    };
  }, [leads, followups]);

  return (
    <CRMContext.Provider
      value={{
        currentUser,
        profiles,
        leads,
        interactions,
        followups,
        isSupabaseConfigured,
        activeRole: currentUser?.role || null,
        visibleLeads,
        visibleFollowups,
        visibleInteractions,
        todayPriorityFollowups,
        loginAs,
        loginWithEmail,
        logout,
        addLead,
        logInteraction,
        completeFollowup,
        rescheduleFollowup,
        reassignLead,
        createRepAccount,
        lastWebhookDispatched,
        clearWebhookNotification,
        runDailyCronCheck,
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
