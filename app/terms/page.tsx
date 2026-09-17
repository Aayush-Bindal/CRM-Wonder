import type { Metadata } from 'next';
import LegalDocument, { Section } from '@/components/LegalDocument';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: `Terms of Use — ${LEGAL.productName}`,
  description: `The terms that govern use of ${LEGAL.productName}, including account responsibility, permitted use of customer data, and ownership.`,
};

export default function TermsOfUsePage() {
  return (
    <LegalDocument
      title="Terms of Use"
      lede={
        <>
          In short: {LEGAL.productName} is licensed to your organisation, not to you personally. Your account
          is yours alone, the customer records in the CRM belong to your organisation, and you must not copy
          them out or let anyone else in. The service is provided as it is, and your organisation’s own
          agreement with the software provider governs the commercial relationship.
        </>
      }
    >
      <Section n="01" title="These terms">
        <p>
          {LEGAL.productName} is supplied by its software provider (‘the provider’) and operated by your
          organisation. These terms are between you and the provider, and they govern your use of the CRM.
        </p>
        <p>
          Your organisation has a separate agreement with the provider covering licensing, fees and support.
          Nothing on this page changes that agreement, and these terms create no payment obligation on you.
        </p>
        <p>
          By signing in you accept these terms. If you do not accept them, do not sign in — speak to your
          administrator instead.
        </p>
      </Section>

      <Section n="02" title="Your account">
        <ul>
          <li>
            Accounts are created by an administrator. There is no self-registration, and an account is for
            one named person only.
          </li>
          <li>Keep your password to yourself. Do not share it, and do not let anyone else use your account.</li>
          <li>
            You are responsible for what is done through your account. That matters beyond your own
            convenience here: a note is recorded against the name of the person who wrote it, and a customer
            against the representative who owns them.
          </li>
          <li>
            Tell your administrator immediately if you think someone else has your password, or if you see
            activity in the CRM that is not yours.
          </li>
          <li>An administrator can reset your password, change your role, or deactivate your account.</li>
        </ul>
      </Section>

      <Section n="03" title="What you may use it for">
        <p>
          Use the CRM for your organisation’s real estate business, and only for the records your role allows
          you to see. Sales representatives see only their own assigned customers; administrators see the
          whole organisation.
        </p>
      </Section>

      <Section n="04" title="What you must not do">
        <ul>
          <li>Share your sign-in details, or use anyone else’s account.</li>
          <li>
            Try to reach records you are not entitled to, including by working around the permission model
            instead of using the app.
          </li>
          <li>
            Copy, export, scrape or bulk-download customer data, except as your role genuinely requires in
            order to do your job.
          </li>
          <li>
            Send customer data to a personal email account, a personal phone, or any app outside the
            organisation. The CRM provides no feature for this, and none should be improvised.
          </li>
          <li>
            Use customer data for your own business, for a competitor, or after you stop working for the
            organisation.
          </li>
          <li>Enter anything unlawful, misleading or abusive, or anything that infringes another person’s rights.</li>
          <li>
            Copy, resell, sublicense or reverse engineer the software, or probe, disrupt or overload the
            service.
          </li>
        </ul>
        <p>
          Breaking these rules can be a breach of your terms of employment or engagement as well as of these
          terms, and access may be withdrawn immediately.
        </p>
      </Section>

      <Section n="05" title="Customer data and confidentiality">
        <p>
          The customer records in the CRM belong to your organisation. You hold them in trust while you work
          there: use them for the organisation’s business, keep them confidential, and do not keep copies of
          your own.
        </p>
        <ul>
          <li>
            When your engagement ends, your access is withdrawn and you must not retain or use any customer
            data you were given.
          </li>
          <li>
            Record information accurately, and only what the job needs. Your organisation is responsible for
            having a lawful basis to hold a customer’s data, and for the accuracy of what is recorded about
            them.
          </li>
          <li>
            Do not record sensitive details — identity numbers, bank or card numbers, medical information —
            in the notes or in any other field.
          </li>
        </ul>
      </Section>

      <Section n="06" title="Roles and permissions">
        <p>
          An <strong>Administrator</strong> can see and change every record in the organisation, create and
          delete accounts, reset passwords and reassign leads. A <strong>Sales Representative</strong> can
          see and work only the leads assigned to them.
        </p>
        <p>
          Roles are set by your organisation and can change. Do not rely on a permission you hold today, and
          do not attempt to grant yourself one.
        </p>
      </Section>

      <Section n="07" title="Ownership">
        <p>
          The software, its design and its code belong to the provider. Your organisation’s data belongs to
          your organisation. Nothing here gives you ownership of either: you are granted permission to use
          the CRM for as long as your organisation’s agreement with the provider lasts and your account is
          active.
        </p>
      </Section>

      <Section n="08" title="Availability and changes">
        <p>
          The CRM is a working tool, not a guaranteed service. It may be unavailable while it is being
          updated, and it depends on a third-party database provider that can have outages of its own. The
          provider may change or withdraw features at any time. Keep anything urgent out of the CRM — it is
          not an emergency channel.
        </p>
      </Section>

      <Section n="09" title="No warranty">
        <p>
          To the extent permitted by law, the CRM is provided as it is, without warranties of any kind,
          whether express or implied — including that it will be uninterrupted, error-free, or fit for a
          particular purpose. Do not rely on it as the only record of anything you cannot afford to lose.
        </p>
      </Section>

      <Section n="10" title="Limitation of liability">
        <p>
          To the extent permitted by law, the provider is not liable to you for indirect or consequential
          loss, or for loss of profit, business, opportunity, goodwill or data, arising from your use of the
          CRM or your inability to use it. Because the CRM is provided to you through your organisation, the
          provider’s liability in connection with the service is governed by its agreement with your
          organisation.
        </p>
        <p>Nothing in these terms limits any liability that cannot be limited by law.</p>
      </Section>

      <Section n="11" title="Suspension and termination">
        <p>
          Your access may be suspended or withdrawn at any time — when your engagement ends, or if these
          terms are broken. Withdrawing access does not delete anything: the customer records stay with your
          organisation and continue to be handled as the Privacy Policy describes.
        </p>
      </Section>

      <Section n="12" title="Governing law">
        <p>
          These terms are governed by, and any dispute arising from them is subject to, the laws of India.
        </p>
      </Section>

      <Section n="13" title="Changes to these terms">
        <p>
          These terms may be updated as the CRM changes. The date at the top of this page is the date of the
          version you are reading, and continuing to use the CRM after a change means you accept it.
        </p>
      </Section>

      <Section n="14" title="Contact" />
    </LegalDocument>
  );
}
