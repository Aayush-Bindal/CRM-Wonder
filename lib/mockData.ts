import { Profile, Lead, Interaction, Followup } from './types';

// Helper to get formatted today date (YYYY-MM-DD)
export const getTodayDateStr = (): string => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

export const getRelativeDateStr = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

export const INITIAL_PROFILES: Profile[] = [
  {
    id: 'usr-admin-01',
    full_name: 'Marcus Vance',
    email: 'admin@luxuryliving.com',
    phone: '+91 98100 11223',
    password: 'Marcus@2026',
    role: 'Admin',
    is_active: true,
    created_at: '2026-01-10T09:00:00Z',
    updated_at: '2026-01-10T09:00:00Z',
  },
  {
    id: 'usr-rep-01',
    full_name: 'Sarah Jenkins',
    email: 'sarah.j@luxuryliving.com',
    phone: '+91 98200 33445',
    password: 'Sarah@2026',
    role: 'Sales_Rep',
    is_active: true,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'usr-rep-02',
    full_name: 'David Chen',
    email: 'david.c@luxuryliving.com',
    phone: '+91 98300 55667',
    password: 'David@2026',
    role: 'Sales_Rep',
    is_active: true,
    created_at: '2026-01-15T10:30:00Z',
    updated_at: '2026-01-15T10:30:00Z',
  },
  {
    id: 'usr-rep-03',
    full_name: 'Priya Sharma',
    email: 'priya.s@luxuryliving.com',
    phone: '+91 98400 77889',
    password: 'Priya@2026',
    role: 'Sales_Rep',
    is_active: true,
    created_at: '2026-01-20T08:15:00Z',
    updated_at: '2026-01-20T08:15:00Z',
  },
  {
    id: 'usr-rep-04',
    full_name: 'Michael Rodriguez',
    email: 'michael.r@luxuryliving.com',
    phone: '+91 98500 99001',
    password: 'Michael@2026',
    role: 'Sales_Rep',
    is_active: true,
    created_at: '2026-02-01T09:45:00Z',
    updated_at: '2026-02-01T09:45:00Z',
  },
  {
    id: 'usr-rep-05',
    full_name: 'Emily Watson',
    email: 'emily.w@luxuryliving.com',
    phone: '+91 98600 11223',
    password: 'Emily@2026',
    role: 'Sales_Rep',
    is_active: true,
    created_at: '2026-02-05T11:00:00Z',
    updated_at: '2026-02-05T11:00:00Z',
  },
  {
    id: 'usr-rep-06',
    full_name: 'James Al-Mansoor',
    email: 'james.a@luxuryliving.com',
    phone: '+91 98700 33445',
    password: 'James@2026',
    role: 'Sales_Rep',
    is_active: true,
    created_at: '2026-02-10T14:20:00Z',
    updated_at: '2026-02-10T14:20:00Z',
  },
  {
    id: 'usr-rep-07',
    full_name: 'Carlos Mendez',
    email: 'carlos.m@luxuryliving.com',
    phone: '+91 98800 55667',
    password: 'Carlos@2026',
    role: 'Sales_Rep',
    is_active: true,
    created_at: '2026-02-15T15:30:00Z',
    updated_at: '2026-02-15T15:30:00Z',
  },
  {
    id: 'usr-rep-08',
    full_name: 'Aisha Patel',
    email: 'aisha.p@luxuryliving.com',
    phone: '+91 98900 77889',
    password: 'Aisha@2026',
    role: 'Sales_Rep',
    is_active: true,
    created_at: '2026-03-01T09:00:00Z',
    updated_at: '2026-03-01T09:00:00Z',
  },
];

// Helper to construct a date matching today's month and day for greeting triggers
const getAnniversaryToday = () => {
  const d = new Date();
  const year = d.getFullYear() - 5;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getBirthdayToday = () => {
  const d = new Date();
  const year = d.getFullYear() - 34;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead-101',
    name: 'Alexander Sterling',
    address: '742 Evergreen Terrace, West End',
    phone_1: '+91 90011 22334',
    mobile_2: '+91 90011 22335',
    dob: getBirthdayToday(), // Sample lead with today's birthday milestone
    marriage_anniversary: '2018-11-20',
    preferred_property: 'Penthouse 42B, The Horizon Tower',
    assigned_rep_id: 'usr-rep-01', // Sarah Jenkins
    status: 'Site Visit',
    budget: '₹1.85 Cr',
    created_at: '2026-09-10T14:30:00Z',
    updated_at: '2026-09-14T11:00:00Z',
  },
  {
    id: 'lead-102',
    name: 'Eleanor & Robert Vance',
    address: '124 Kensington Court, Apt 5',
    phone_1: '+91 90022 33445',
    mobile_2: '+91 90022 33446',
    dob: '1985-04-12',
    marriage_anniversary: getAnniversaryToday(), // Anniversary today!
    preferred_property: '3BHK Flat 1402, Marina Bay Residences',
    assigned_rep_id: 'usr-rep-01', // Sarah Jenkins
    status: 'Negotiation',
    budget: '₹1.2 Cr',
    created_at: '2026-09-08T09:15:00Z',
    updated_at: '2026-09-15T08:30:00Z',
  },
  {
    id: 'lead-103',
    name: 'Dr. Vikram Malhotra',
    address: '88 Medical Enclave, Tower B',
    phone_1: '+91 90033 44556',
    mobile_2: '+91 90033 44557',
    dob: '1979-08-25',
    marriage_anniversary: '2010-02-14',
    preferred_property: 'Villa 19, Cedar Park Estates',
    assigned_rep_id: 'usr-rep-01', // Sarah Jenkins
    status: 'Contacted',
    budget: '₹2.4 Cr',
    created_at: '2026-09-12T16:00:00Z',
    updated_at: '2026-09-13T10:20:00Z',
  },
  {
    id: 'lead-104',
    name: 'Sophia Laurent',
    address: '500 Park Avenue, Suite 12',
    phone_1: '+91 90044 55667',
    mobile_2: '',
    dob: '1992-06-18',
    marriage_anniversary: '',
    preferred_property: '2BHK Designer Flat 804, The Glasshouse',
    assigned_rep_id: 'usr-rep-01', // Sarah Jenkins
    status: 'New',
    budget: '₹85 L',
    created_at: '2026-09-15T09:30:00Z',
    updated_at: '2026-09-15T09:30:00Z',
  },
  {
    id: 'lead-105',
    name: 'Kavita & Ramesh Patel',
    address: '32 Silicon Blvd, Tech Ridge',
    phone_1: '+91 90055 66778',
    mobile_2: '+91 90055 66779',
    dob: '1987-12-05',
    marriage_anniversary: '2014-06-22',
    preferred_property: '4BHK Sky Mansion, Royal Orchid',
    assigned_rep_id: 'usr-rep-02', // David Chen
    status: 'Site Visit',
    budget: '₹2.1 Cr',
    created_at: '2026-09-11T11:45:00Z',
    updated_at: '2026-09-14T17:00:00Z',
  },
  {
    id: 'lead-106',
    name: 'Ethan Cole',
    address: '91 Harbor Point Way',
    phone_1: '+91 90066 77889',
    mobile_2: '',
    dob: '1990-03-30',
    marriage_anniversary: '',
    preferred_property: 'Flat 501, Bayview Terrace',
    assigned_rep_id: 'usr-rep-02', // David Chen
    status: 'Contacted',
    budget: '₹95 L',
    created_at: '2026-09-13T13:20:00Z',
    updated_at: '2026-09-14T15:00:00Z',
  },
  {
    id: 'lead-107',
    name: 'Meera Kapoor',
    address: '15 Greenwood Highlands',
    phone_1: '+91 90077 88990',
    mobile_2: '+91 90077 88991',
    dob: '1983-09-14',
    marriage_anniversary: '2008-12-10',
    preferred_property: 'Garden Duplex B-2, The Grove',
    assigned_rep_id: 'usr-rep-03', // Priya Sharma
    status: 'Negotiation',
    budget: '₹1.65 Cr',
    created_at: '2026-09-05T10:00:00Z',
    updated_at: '2026-09-14T18:00:00Z',
  },
  {
    id: 'lead-108',
    name: 'Jonathan Bennett',
    address: '400 Financial Center, Apt 18B',
    phone_1: '+91 90088 99001',
    mobile_2: '',
    dob: '1981-11-03',
    marriage_anniversary: '2007-07-07',
    preferred_property: 'Penthouse 1, Grand Central Heights',
    assigned_rep_id: 'usr-rep-04', // Michael Rodriguez
    status: 'Site Visit',
    budget: '₹3.2 Cr',
    created_at: '2026-09-09T15:30:00Z',
    updated_at: '2026-09-15T07:45:00Z',
  },
  {
    id: 'lead-109',
    name: 'Chloe Zhang',
    address: '210 University Avenue',
    phone_1: '+91 90099 00112',
    mobile_2: '',
    dob: '1995-02-28',
    marriage_anniversary: '',
    preferred_property: 'Studio Loft 305, Urban Core',
    assigned_rep_id: 'usr-rep-05', // Emily Watson
    status: 'New',
    budget: '₹62 L',
    created_at: '2026-09-15T11:00:00Z',
    updated_at: '2026-09-15T11:00:00Z',
  },
  {
    id: 'lead-110',
    name: 'Tariq Mansoor',
    address: '89 Palm Jumeirah Lane',
    phone_1: '+91 90100 11223',
    mobile_2: '+91 90100 11224',
    dob: '1976-10-14',
    marriage_anniversary: '2002-05-18',
    preferred_property: 'Custom Villa 7, Sunset Bay',
    assigned_rep_id: 'usr-rep-06', // James Al-Mansoor
    status: 'Closed Won',
    budget: '₹4.5 Cr',
    created_at: '2026-08-20T12:00:00Z',
    updated_at: '2026-09-12T16:30:00Z',
  },
  {
    id: 'lead-111',
    name: 'Lucas & Maria Silva',
    address: '77 Valencia Way',
    phone_1: '+91 90111 22334',
    mobile_2: '',
    dob: '1989-01-22',
    marriage_anniversary: '2016-08-30',
    preferred_property: '3BHK Flat 901, Solaris Towers',
    assigned_rep_id: 'usr-rep-07', // Carlos Mendez
    status: 'Contacted',
    budget: '₹1.15 Cr',
    created_at: '2026-09-14T10:10:00Z',
    updated_at: '2026-09-14T14:00:00Z',
  },
  {
    id: 'lead-112',
    name: 'Fatima Al-Sayed',
    address: '16 Oasis Ridge',
    phone_1: '+91 90122 33445',
    mobile_2: '+91 90122 33446',
    dob: '1988-07-19',
    marriage_anniversary: '2013-11-15',
    preferred_property: 'Townhouse 12, Mirage Gardens',
    assigned_rep_id: 'usr-rep-08', // Aisha Patel
    status: 'Site Visit',
    budget: '₹1.9 Cr',
    created_at: '2026-09-10T08:30:00Z',
    updated_at: '2026-09-15T10:00:00Z',
  },
];

export const INITIAL_INTERACTIONS: Interaction[] = [
  {
    id: 'int-001',
    lead_id: 'lead-101',
    rep_id: 'usr-rep-01',
    notes: 'Phone inquiry regarding Penthouse 42B corner unit terrace dimensions. Sent brochure via WhatsApp.',
    interaction_type: 'Phone Call',
    created_at: '2026-09-10T14:35:00Z',
  },
  {
    id: 'int-002',
    lead_id: 'lead-101',
    rep_id: 'usr-rep-01',
    notes: 'Conducted first virtual walk-through of Penthouse 42B. Buyer loved the double-height ceiling. Requested private site visit.',
    interaction_type: 'WhatsApp',
    created_at: '2026-09-12T16:00:00Z',
  },
  {
    id: 'int-003',
    lead_id: 'lead-102',
    rep_id: 'usr-rep-01',
    notes: 'In-person meeting at show flat 1402. Eleanor inspected master suite and balcony orientation. Discussed 10% booking token terms.',
    interaction_type: 'In-Person Meeting',
    created_at: '2026-09-14T15:30:00Z',
  },
  {
    id: 'int-004',
    lead_id: 'lead-103',
    rep_id: 'usr-rep-01',
    notes: 'Called Dr. Malhotra to follow up on Cedar Park Villa 19 layout. He was in clinic; asked for callback today at 3 PM.',
    interaction_type: 'Phone Call',
    created_at: '2026-09-13T10:20:00Z',
  },
  {
    id: 'int-005',
    lead_id: 'lead-104',
    rep_id: 'usr-rep-01',
    notes: 'Captured walk-in lead at sales desk. Sophia is looking for an investment property near metro line. High intent.',
    interaction_type: 'In-Person Meeting',
    created_at: '2026-09-15T09:30:00Z',
  },
  {
    id: 'int-006',
    lead_id: 'lead-105',
    rep_id: 'usr-rep-02',
    notes: 'Detailed discussion on Royal Orchid parking allocations and payment schedule linked to construction milestones.',
    interaction_type: 'Phone Call',
    created_at: '2026-09-14T17:00:00Z',
  },
  {
    id: 'int-007',
    lead_id: 'lead-107',
    rep_id: 'usr-rep-03',
    notes: 'Negotiated final pricing for The Grove Garden Duplex. Offered complimentary clubhouse membership.',
    interaction_type: 'In-Person Meeting',
    created_at: '2026-09-14T18:00:00Z',
  },
  {
    id: 'int-008',
    lead_id: 'lead-108',
    rep_id: 'usr-rep-04',
    notes: 'Completed site visit at Grand Central Heights Penthouse 1. Buyer is evaluating between this and a competitor downtown.',
    interaction_type: 'Site Visit',
    created_at: '2026-09-15T07:45:00Z',
  },
];

export const INITIAL_FOLLOWUPS: Followup[] = [
  // Today's Follow-ups for Sarah Jenkins (usr-rep-01)
  {
    id: 'fup-001',
    lead_id: 'lead-101',
    rep_id: 'usr-rep-01',
    followup_date: getTodayDateStr(), // Today
    status: 'Pending',
    notes: 'Confirm private site visit timing for Penthouse 42B (client requested around 4:30 PM). Bring physical floor plan kit.',
    created_at: '2026-09-14T11:00:00Z',
  },
  {
    id: 'fup-002',
    lead_id: 'lead-102',
    rep_id: 'usr-rep-01',
    followup_date: getTodayDateStr(), // Today
    status: 'Pending',
    notes: 'Send revised payment plan sheet for Flat 1402 Marina Bay and wish them on their Wedding Anniversary today!',
    created_at: '2026-09-14T16:00:00Z',
  },
  {
    id: 'fup-003',
    lead_id: 'lead-103',
    rep_id: 'usr-rep-01',
    followup_date: getTodayDateStr(), // Today
    status: 'Pending',
    notes: 'Call Dr. Malhotra at 3:00 PM as requested regarding Cedar Park Villa 19 payment milestone breakdown.',
    created_at: '2026-09-13T10:25:00Z',
  },
  // Completed today by Sarah Jenkins
  {
    id: 'fup-004',
    lead_id: 'lead-104',
    rep_id: 'usr-rep-01',
    followup_date: getTodayDateStr(), // Today
    status: 'Completed',
    notes: 'Sent project brochure and studio price list to Sophia via WhatsApp.',
    completed_at: '2026-09-15T10:15:00Z',
    created_at: '2026-09-15T09:35:00Z',
  },

  // Today's follow-ups for other sales reps (Admins see all, reps only see theirs)
  {
    id: 'fup-005',
    lead_id: 'lead-105',
    rep_id: 'usr-rep-02', // David Chen
    followup_date: getTodayDateStr(), // Today
    status: 'Pending',
    notes: 'Send structural approval documents for Sky Mansion at Royal Orchid to Mr. Patel.',
    created_at: '2026-09-14T17:10:00Z',
  },
  {
    id: 'fup-006',
    lead_id: 'lead-107',
    rep_id: 'usr-rep-03', // Priya Sharma
    followup_date: getTodayDateStr(), // Today
    status: 'Pending',
    notes: 'Receive signed booking deed and advance deposit receipt for The Grove Duplex B-2.',
    created_at: '2026-09-14T18:15:00Z',
  },
  {
    id: 'fup-007',
    lead_id: 'lead-108',
    rep_id: 'usr-rep-04', // Michael Rodriguez
    followup_date: getTodayDateStr(), // Today
    status: 'Pending',
    notes: 'Follow up after morning site visit with comparative market appraisal sheet.',
    created_at: '2026-09-15T08:00:00Z',
  },
  {
    id: 'fup-008',
    lead_id: 'lead-112',
    rep_id: 'usr-rep-08', // Aisha Patel
    followup_date: getTodayDateStr(), // Today
    status: 'Pending',
    notes: 'Confirm weekend site visit for Mirage Gardens Townhouse 12.',
    created_at: '2026-09-15T10:05:00Z',
  },

  // Future followups
  {
    id: 'fup-009',
    lead_id: 'lead-106',
    rep_id: 'usr-rep-02',
    followup_date: getRelativeDateStr(2),
    status: 'Pending',
    notes: 'Follow up on bank loan pre-approval status.',
    created_at: '2026-09-14T15:10:00Z',
  },
  {
    id: 'fup-010',
    lead_id: 'lead-111',
    rep_id: 'usr-rep-07',
    followup_date: getRelativeDateStr(3),
    status: 'Pending',
    notes: 'Schedule second viewing with client architect.',
    created_at: '2026-09-14T14:15:00Z',
  },
];
