import React from 'react';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

// A numbered section of a legal document. Numbered headings make a long policy
// referenceable ("section 8") in a reply to a data request. A section may be
// empty — the heading alone is then all that renders.
export function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <section>
      <h2>
        <span>{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// The page frame shared by /privacy and /terms: brand bar, title block, the
// plain-language summary, then the document itself.
export default function LegalDocument({
  title,
  lede,
  children,
}: {
  title: string;
  lede: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-[#ffffff]">
      <header className="border-b border-[#e8e8e8]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="h-3 w-3 bg-[#ff682c]" aria-hidden />
            <span className="font-mono text-xs uppercase tracking-widest text-[#828282]">CRM</span>
            <span className="text-lg font-bold tracking-tight text-[#202020]">WONDER</span>
          </Link>
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-widest text-[#828282] transition-colors hover:text-[#202020]"
          >
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#816729]">
            {LEGAL.productName} · Legal
          </p>
          <h1 className="mt-3 text-4xl font-normal tracking-tight text-[#202020] sm:text-5xl">{title}</h1>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-[#828282]">
            Last updated {LEGAL.effectiveDate}
          </p>

          <div className="mt-8 border-l-2 border-[#ff682c] bg-[#f5f5f5] px-5 py-4">
            <p className="text-sm leading-relaxed text-[#4d4d4d]">{lede}</p>
          </div>

          <article className="legal-prose mt-10">{children}</article>
        </div>
      </main>
    </div>
  );
}
