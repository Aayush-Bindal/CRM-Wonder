import type {Metadata} from 'next';
import './globals.css'; // Global styles
import LegalFooter from '@/components/LegalFooter';

export const metadata: Metadata = {
  title: 'Wonder',
  description: 'Mobile-first Real Estate Sales CRM designed for property brokerages, lead pipeline tracking, and intelligent follow-up scheduling.',
  openGraph: {
    title: 'Wonder',
    description: 'Mobile-first Real Estate Sales CRM designed for property brokerages, lead pipeline tracking, and intelligent follow-up scheduling.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wonder',
    description: 'Mobile-first Real Estate Sales CRM designed for property brokerages, lead pipeline tracking, and intelligent follow-up scheduling.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      {/* The legal footer is mounted once, here, so it is present on every screen
          — the sign-in card, the legal documents and the CRM itself. Page roots
          carry flex-1 so the footer falls to the floor of the viewport. */}
      <body className="flex min-h-screen flex-col" suppressHydrationWarning>
        {children}
        <LegalFooter />
      </body>
    </html>
  );
}
