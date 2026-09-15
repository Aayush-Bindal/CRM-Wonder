import type {Metadata} from 'next';
import './globals.css'; // Global styles

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
