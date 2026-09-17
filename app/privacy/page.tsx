import type { Metadata } from 'next';
import LegalDocument, { Section } from '@/components/LegalDocument';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: `Privacy Policy — ${LEGAL.productName}`,
  description: `How the team accounts and customer records held in ${LEGAL.productName} are stored, used and protected.`,
};

// Every statement below is written against what this application actually does:
// the columns in supabase/migrations, the row-level policies, and the permission
// grants. If the behaviour changes, this page has to change with it — a notice
// that promises more than the software does is worse than no notice.
export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      lede={
        <>
          In short: {LEGAL.productName} holds the accounts of your sales team and the customer records your
          team enters. Those records live in a Supabase database, are visible only to people whose role
          allows it, and are never sold, rented or used for advertising. There is no public sign-up — every
          account is created by an administrator. This page sets out the detail.
        </>
      }
    >
      <Section n="01" title="Who we are">
        <p>
          {LEGAL.productName} is operated by the real estate business that runs it (‘we’, ‘us’) for its own
          sales operations. We decide what personal data the CRM holds and what it is used for, which makes
          us the Data Fiduciary for that data under the Digital Personal Data Protection Act, 2023.
        </p>
        <p>This notice covers two different groups of people:</p>
        <ul>
          <li>
            <strong>Team members</strong> — the sales representatives and administrators who sign in to the
            CRM.
          </li>
          <li>
            <strong>Customers</strong> — the buyers and enquirers whose details the team records while
            working a lead.
          </li>
        </ul>
        <p>
          If you are a customer, your relationship is with us rather than with the company that built the
          software. Use the contact details in section 13 for anything to do with your data.
        </p>
      </Section>

      <Section n="02" title="Information we hold about team members">
        <dl>
          <dt>Identity and contact</dt>
          <dd>Full name, email address, and the phone or WhatsApp number on your account.</dd>
          <dt>Access</dt>
          <dd>
            Your role — Administrator or Sales Representative — whether the account is active, and the dates
            it was created and last changed.
          </dd>
          <dt>Activity</dt>
          <dd>
            What you do in the CRM, tied to your name: the leads assigned to you, the notes you write, and
            the follow-ups you complete.
          </dd>
          <dt>Credentials</dt>
          <dd>
            Your email address and a one-way hash of your password. Nobody can read your password back —
            not us, not an administrator, not the software vendor. An administrator can replace it with a
            new one, but cannot see the old one.
          </dd>
        </dl>
      </Section>

      <Section n="03" title="Information we hold about customers">
        <p>When the team records an enquiry, that record can hold:</p>
        <ul>
          <li>Name, address, and two phone numbers.</li>
          <li>
            Date of birth and marriage anniversary, where a representative records them so the team can
            send greetings.
          </li>
          <li>The property the customer is interested in, and their budget.</li>
          <li>
            Where the enquiry stands — new, contacted, site visit, negotiation, closed won or closed lost —
            and which representative owns it.
          </li>
          <li>
            Every note logged against the customer: what was said on a call, at a site visit or over
            WhatsApp, with the date and the name of the person who wrote it.
          </li>
          <li>Follow-ups scheduled against the customer, and whether they were completed.</li>
        </ul>
        <p>
          Notes are free text, so whatever a representative types becomes part of the customer’s record.
          Keep entries factual and about the property conversation.
        </p>
        <p>
          <strong>Please do not record more than the job needs.</strong> Do not put bank or card numbers,
          government identity numbers, medical information, or anything about a person’s religion, caste or
          political views into the notes field or anywhere else. If a document like that has to be kept, it
          belongs in the organisation’s own filing system, not here.
        </p>
      </Section>

      <Section n="04" title="Why we hold it">
        <p>We use this information only to run the sales operation:</p>
        <ul>
          <li>To give each representative the customers assigned to them and the follow-ups due today.</li>
          <li>
            To keep a customer relationship in one place, so the conversation continues properly from one
            call to the next.
          </li>
          <li>To report on the pipeline — enquiries, site visits, negotiations and bookings.</li>
          <li>To contact a customer about a property they asked about.</li>
          <li>To keep the service secure and accountable: who owns a lead, and who wrote a note.</li>
          <li>To meet record-keeping obligations that apply to completed sales.</li>
        </ul>
        <p>
          We do not use this information for advertising, we do not profile people for any other purpose,
          and we do not sell or rent it to anyone.
        </p>
      </Section>

      <Section n="05" title="Where it is stored, and who processes it">
        <p>
          Team accounts and customer records are held in <strong>Supabase</strong> — a managed PostgreSQL
          database and sign-in service — running on Amazon Web Services infrastructure. Supabase acts as our
          data processor: it stores and serves the data on our instructions and does not use it for its own
          purposes.
        </p>
        <ul>
          <li>
            Traffic between a browser and the database travels over TLS, and Supabase encrypts the stored
            data at rest.
          </li>
          <li>
            Operations that carry administrative power — creating an account, resetting a password, deleting
            a record — run on our server with a key that is never sent to a browser.
          </li>
          <li>
            We embed no advertising networks, no third-party analytics and no social media trackers, and the
            CRM sends your data to no other service.
          </li>
        </ul>
      </Section>

      <Section n="06" title="Who can see it">
        <dl>
          <dt>Administrators</dt>
          <dd>
            Every record in the organisation: all customers, every note and follow-up, and every team
            member’s account.
          </dd>
          <dt>Sales representatives</dt>
          <dd>
            Only the customers assigned to them, the notes on those customers, and their own follow-ups —
            nothing else. A representative cannot see, search or export another representative’s customers.
          </dd>
          <dt>All signed-in team members</dt>
          <dd>
            The directory of active colleagues — name, email, phone and role — which is what lets the CRM
            show who owns a lead. Deactivated accounts are not listed.
          </dd>
          <dt>Deactivated accounts</dt>
          <dd>Their own profile row and nothing else, so the app can explain why they are locked out.</dd>
          <dt>Anyone not signed in</dt>
          <dd>
            Nothing at all. These limits are enforced by the database itself, row by row, rather than by the
            interface — so they hold even if someone tries to reach the data without using the app.
          </dd>
          <dt>The software vendor</dt>
          <dd>
            Can reach the database for support and maintenance, and does so only when we ask. The vendor
            does not use the data for any purpose of its own.
          </dd>
        </dl>
      </Section>

      <Section n="07" title="What is stored in your browser">
        <p>
          When you sign in, the CRM keeps a session token in your browser’s local storage. It is what stops
          you being asked for your password on every screen, and it is removed when you sign out or when it
          expires. The CRM sets no advertising or analytics cookies and embeds no third-party trackers.
        </p>
      </Section>

      <Section n="08" title="How long we keep it">
        <p>
          Records are kept for as long as they are needed for the purposes above and for our legal and
          accounting obligations. Nothing is deleted automatically, and no customer record carries an expiry
          date.
        </p>
        <ul>
          <li>
            Deleting a customer removes their record together with every note and follow-up attached to it.
          </li>
          <li>
            An administrator can delete a team member’s account only once that person’s customers and
            activity have been reassigned or removed. The CRM refuses to delete an account that still has
            work attached, so history is not lost by accident.
          </li>
          <li>
            Deactivating an account blocks access to CRM data straight away. The token already issued to
            that person’s device stops working when it expires.
          </li>
        </ul>
        <p>
          If you ask us to delete your data, we will do so unless we are required to keep it — for example,
          a completed sale that has to stay on record.
        </p>
      </Section>

      <Section n="09" title="Your choices and your rights">
        <p>
          Under the Digital Personal Data Protection Act, 2023 you can ask to see the personal data we hold
          about you, ask us to correct it, ask us to erase it, and raise a grievance about how it has been
          handled.
        </p>
        <ul>
          <li>
            <strong>Customers</strong> — speak to the representative handling your enquiry, or to the team
            at the office you dealt with.
          </li>
          <li>
            <strong>Team members</strong> — ask your administrator to correct your name, phone number or
            account details.
          </li>
        </ul>
        <p>
          Corrections and deletions are carried out by an administrator from the CRM’s own console, so a
          request we accept is actioned by the same team that entered the data. We aim to respond within 30
          days. If you are not satisfied with our response, you can complain to the Data Protection Board of
          India.
        </p>
      </Section>

      <Section n="10" title="How we protect it">
        <ul>
          <li>
            Every table is protected by row-level security, so the database decides which records each
            signed-in person may read or change — not the screens they happen to be shown.
          </li>
          <li>
            Permissions are set column by column: a representative cannot change their own role, email
            address or account status, and cannot promote themselves to administrator.
          </li>
          <li>
            The last remaining administrator cannot be deleted, so the organisation can never be locked out
            of its own data.
          </li>
          <li>Accounts are only created by an administrator, and public sign-up is switched off.</li>
          <li>
            Passwords are stored as one-way hashes, and administrative operations use a server-side key that
            is never exposed to a browser.
          </li>
        </ul>
        <p>
          No system is perfectly secure. If you believe an account or a customer record has been exposed,
          tell your administrator immediately — and if you are a customer, contact the office you dealt with.
        </p>
      </Section>

      <Section n="11" title="Children">
        <p>
          The CRM is a business tool for adults and is not intended for use by anyone under 18. Customer
          records should not contain a child’s personal data unless there is a specific and lawful reason to
          hold it.
        </p>
      </Section>

      <Section n="12" title="Changes to this notice">
        <p>
          We will update this notice when the way the CRM handles data changes. The date at the top of this
          page is always the date of the version you are reading.
        </p>
      </Section>

      <Section n="13" title="Contact us" />
    </LegalDocument>
  );
}
