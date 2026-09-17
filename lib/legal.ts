// ---------------------------------------------------------------------------
// Published by the Privacy Policy, the Terms of Use and the site-wide footer.
//
// The operator, the software provider and the grievance contact are deliberately
// unnamed throughout, because none of them has been settled yet. When they are,
// this file is where they belong — the sentences that would carry them are:
//
//   Privacy Policy  section 01  who operates the CRM        operator name
//   Privacy Policy  section 05  where the data is held      Supabase project region
//   Privacy Policy  section 09  how a request is made       contact address
//   Privacy Policy  section 13  Contact us                  operator, address, contact, Grievance Officer
//   Terms of Use    section 01  who supplies the software   provider legal name
//   Terms of Use    section 12  governing law               city whose courts hear disputes
// ---------------------------------------------------------------------------
export const LEGAL = {
  productName: 'Wonder CRM',
  effectiveDate: '17 September 2026',
} as const;

// The footer and both documents read this, so a link label or path can never
// drift between them.
export const LEGAL_DOCS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Use' },
] as const;
