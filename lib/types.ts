export type UserRole = 'Admin' | 'Sales_Rep';

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Site Visit'
  | 'Negotiation'
  | 'Closed Won'
  | 'Closed Lost';

// The property types Add Lead offers. leads.preferred_property stores the
// selected ones comma-joined ("2BHK, 3BHK"), so anything that reads or filters
// on the field parses tokens rather than comparing whole strings.
export const PREFERRED_PROPERTY_TYPES = ['Studio', '1BHK', '2BHK', '3BHK', '4BHK'] as const;

export type PreferredPropertyType = (typeof PREFERRED_PROPERTY_TYPES)[number];

export type InteractionType =
  | 'Phone Call'
  | 'Site Visit'
  | 'WhatsApp'
  | 'In-Person Meeting'
  | 'Email';

export type FollowupStatus = 'Pending' | 'Completed';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  address?: string;
  phone_1: string;
  mobile_2?: string;
  dob?: string; // YYYY-MM-DD
  marriage_anniversary?: string; // YYYY-MM-DD
  preferred_property: string;
  // Null for historical imports: the lead arrived without an owner and waits
  // for an Admin to assign it. RLS hides these rows from reps.
  assigned_rep_id: string | null;
  status: LeadStatus;
  budget?: string;
  created_at: string;
  updated_at: string;
  // joined fields
  assigned_rep?: Profile;
}

export interface Interaction {
  id: string;
  lead_id: string;
  rep_id: string;
  notes: string;
  interaction_type: InteractionType;
  created_at: string;
  // joined fields
  lead?: Lead;
  rep?: Profile;
}

export interface Followup {
  id: string;
  lead_id: string;
  rep_id: string;
  followup_date: string; // YYYY-MM-DD
  status: FollowupStatus;
  notes?: string;
  completed_at?: string;
  created_at: string;
  // joined fields
  lead?: Lead;
  rep?: Profile;
}

export interface AppState {
  currentUser: Profile | null;
  profiles: Profile[];
  leads: Lead[];
  interactions: Interaction[];
  followups: Followup[];
  isSupabaseConfigured: boolean;
}

// The fields a lead's owner may correct after capture. Deliberately excludes
// assigned_rep_id (that is the admin reassignment flow) and status (the pipeline
// controls), and mirrors the column grants in the migrations.
export type LeadEditableFields = Pick<
  Lead,
  | 'name'
  | 'phone_1'
  | 'mobile_2'
  | 'address'
  | 'dob'
  | 'marriage_anniversary'
  | 'preferred_property'
  | 'budget'
>;

// One validated CSV row destined for public.leads. Historical imports carry no
// owner: they are past records, not live workload, so assigned_rep_id is always
// null until an Admin reassigns them.
export interface LeadImportRow {
  name: string;
  phone_1: string;
  mobile_2: string | null;
  address: string | null;
  dob: string | null;
  marriage_anniversary: string | null;
  preferred_property: string;
  budget: string | null;
  status: LeadStatus;
  assigned_rep_id: null;
}
